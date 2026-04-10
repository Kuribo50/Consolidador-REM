import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { JOB_WAIT_TIMEOUT_MS } from "../../../backend/queue/config";
import {
  getQueueContext,
  runConsolidarScript,
  type ConsolidarJobResult,
} from "../../../backend/queue/consolidar-queue";

export const runtime = "nodejs";
export const maxDuration = 900;

export async function POST(req: NextRequest) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "consolidador-"));
  const outputDir = path.join(tmpDir, "output");
  fs.mkdirSync(outputDir);

  const CENTRO_PART = "CESFAM_Dr_Alberto_Reyes";

  const sanitizeFilenamePart = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const normalized = trimmed
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "");
    const safe = normalized
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .replace(/_+/g, "_")
      .slice(0, 60);
    return safe.replace(/^[_-]+|[_-]+$/g, "");
  };

  try {
    const formData = await req.formData();
    const formato = (formData.get("formato") as string) || "csv";
    const tipo = (formData.get("tipo") as string) || "auto";
    const diccionarioTipo = (formData.get("diccionarioTipo") as string) || "";
    const diccionarioNombreRaw = (formData.get("diccionarioNombre") as string) || "";
    const diccionarioPart = sanitizeFilenamePart(diccionarioNombreRaw);
    const tipoParaNombre =
      tipo === "auto" && (diccionarioTipo === "rm" || diccionarioTipo === "percapita")
        ? diccionarioTipo
        : tipo;
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const nombreSalida = diccionarioPart
      ? `Consolidado_${CENTRO_PART}_${tipoParaNombre.toUpperCase()}_${diccionarioPart}_${timestamp}.${formato}`
      : `Consolidado_${CENTRO_PART}_${tipoParaNombre.toUpperCase()}_${timestamp}.${formato}`;
    const outputPath = path.join(outputDir, nombreSalida);

    // Guardar archivos subidos en carpeta temporal
    const archivos = formData.getAll("archivos") as File[];
    if (!archivos || archivos.length === 0) {
      return NextResponse.json(
        { error: "No se recibieron archivos." },
        { status: 400 },
      );
    }

    for (const archivo of archivos) {
      const buffer = Buffer.from(await archivo.arrayBuffer());
      fs.writeFileSync(path.join(tmpDir, archivo.name), buffer);
    }

    // Ruta al script Python
    const scriptPath = path.join(process.cwd(), "backend", "consolidar.py");

    const separador = (formData.get("separador") as string) || "auto";

    let stderr = "";
    let queueMode: "redis" | "direct" = "direct";
    let queueWaitMs = 0;
    const usarColaRedis = process.env.CONSOLIDAR_QUEUE_MODE === "redis";

    if (usarColaRedis) {
      try {
        const { queue, events } = await getQueueContext();
        const job = await queue.add("consolidar", {
          scriptPath,
          inputDir: tmpDir,
          outputPath,
          formato: formato === "xlsx" ? "xlsx" : "csv",
          tipo,
          separador,
          diccionarioTipo: diccionarioTipo || undefined,
          diccionarioNombre: diccionarioNombreRaw || undefined,
        });
        const jobResult = (await job.waitUntilFinished(
          events,
          JOB_WAIT_TIMEOUT_MS,
        )) as ConsolidarJobResult;
        stderr = jobResult?.stderr ?? "";
        queueMode = "redis";
        const finalJob = job.id ? await queue.getJob(job.id) : null;
        if (finalJob?.processedOn && finalJob?.timestamp) {
          queueWaitMs = Math.max(0, finalJob.processedOn - finalJob.timestamp);
        }
      } catch (queueErr) {
        const res = await runConsolidarScript({
          scriptPath,
          inputDir: tmpDir,
          outputPath,
          formato: formato === "xlsx" ? "xlsx" : "csv",
          tipo,
          separador,
          diccionarioTipo: diccionarioTipo || undefined,
          diccionarioNombre: diccionarioNombreRaw || undefined,
        });
        stderr = res.stderr;
        console.warn(
          "[Consolidador] Cola Redis no disponible. Ejecutando modo directo.",
          (queueErr as Error)?.message ?? "",
        );
      }
    } else {
      const res = await runConsolidarScript({
        scriptPath,
        inputDir: tmpDir,
        outputPath,
        formato: formato === "xlsx" ? "xlsx" : "csv",
        tipo,
        separador,
        diccionarioTipo: diccionarioTipo || undefined,
        diccionarioNombre: diccionarioNombreRaw || undefined,
      });
      stderr = res.stderr;
    }

    // Parsear metadata del stderr
    let meta = {
      filas: 0,
      columnas: 0,
      archivos: 0,
      nombre: nombreSalida,
      columnas_unidas: 0,
      columnas_renombradas: 0,
      columnas_faltantes: 0,
      columnas_extras: 0,
      columnas_sacadas: 0,
      preview_renombradas: "",
      preview_faltantes: "",
      preview_extras: "",
    };
    const metaMatch = stderr.match(/METADATA::(\{.*\})/);
    if (metaMatch) {
      try {
        meta = { ...meta, ...JSON.parse(metaMatch[1]) };
      } catch {}
    }

    // Leer archivo generado
    if (!fs.existsSync(outputPath)) {
      const errLines = stderr
        .split("\n")
        .filter((l) => l.includes("[ERROR]"))
        .join(" | ");
      return NextResponse.json(
        { error: `El script no generó el archivo de salida. ${errLines}` },
        { status: 500 },
      );
    }

    const fileBuffer = fs.readFileSync(outputPath);
    const mimeType =
      formato === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv;charset=utf-8";

    // Log de info para el servidor
    const infoLines = stderr
      .split("\n")
      .filter((l) => l.includes("[INFO]"))
      .map((l) => l.replace("[INFO] ", "").trim())
      .filter(Boolean);

    console.log("[Consolidador] Proceso completado:", infoLines.join(" | "));

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${meta.nombre}"`,
        "X-Consolidador-Filas": String(meta.filas),
        "X-Consolidador-Columnas": String(meta.columnas),
        "X-Consolidador-Archivos": String(meta.archivos),
        "X-Consolidador-Nombre": meta.nombre,
        "X-Consolidador-Cols-Unidas": String(meta.columnas_unidas ?? 0),
        "X-Consolidador-Cols-Renombradas": String(meta.columnas_renombradas ?? 0),
        "X-Consolidador-Cols-Faltantes": String(meta.columnas_faltantes ?? 0),
        "X-Consolidador-Cols-Extras": String(meta.columnas_extras ?? 0),
        "X-Consolidador-Cols-Sacadas": String(meta.columnas_sacadas ?? 0),
        "X-Consolidador-Preview-Renombradas": encodeURIComponent(
          String(meta.preview_renombradas ?? ""),
        ),
        "X-Consolidador-Preview-Faltantes": encodeURIComponent(
          String(meta.preview_faltantes ?? ""),
        ),
        "X-Consolidador-Preview-Extras": encodeURIComponent(
          String(meta.preview_extras ?? ""),
        ),
        "X-Consolidador-Queue-Mode": queueMode,
        "X-Consolidador-Queue-Wait-Ms": String(queueWaitMs),
      },
    });
  } catch (err: unknown) {
    const error = err as { message?: string; stderr?: string; code?: number };
    console.error("[Consolidador] Error:", error.message);

    // Distinguir timeout de otros errores
    if (error.code === 1 && error.stderr?.includes("timeout")) {
      return NextResponse.json(
        {
          error:
            "El proceso tardó demasiado. Intente con menos archivos o use formato CSV.",
        },
        { status: 504 },
      );
    }

    const errMsg =
      error.stderr
        ?.split("\n")
        .filter((l: string) => l.includes("[ERROR]"))
        .map((l: string) => l.replace("[ERROR] ", "").trim())
        .filter(Boolean)
        .join(" | ") ||
      error.message ||
      "Error desconocido";

    // Log full stderr to server console for debugging
    if (error.stderr) {
      console.error("[Consolidador] stderr completo:\n", error.stderr);
    }

    return NextResponse.json({ error: errMsg }, { status: 500 });
  } finally {
    // Limpiar archivos temporales
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}
