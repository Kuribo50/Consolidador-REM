#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const API_URL = process.env.CONSOLIDAR_URL ?? "http://localhost:3000/api/consolidar";
const DATA_DIR =
  process.env.CONSOLIDAR_DATA_DIR ??
  "";
const FORMATO = process.env.CONSOLIDAR_FORMATO ?? "csv"; // csv | xlsx
const QUERY_NAME = process.env.CONSOLIDAR_QUERY ?? "RM-ProduccionCitas";
const TIMEOUT_MS = Number(process.env.CONSOLIDAR_TIMEOUT_MS ?? 300000);
const LADDER = (process.env.CONSOLIDAR_LADDER ?? "1,2,4,6,8,10")
  .split(",")
  .map((n) => Number(n.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function pickCsvFiles(dir, max = 3) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".csv"))
    .map((e) => path.join(dir, e.name))
    .sort();
  if (files.length < max) {
    throw new Error(`No hay suficientes CSV en ${dir}. Encontrados: ${files.length}`);
  }
  return files.slice(0, max);
}

async function postConsolidar(filePaths, userId) {
  const controller = new AbortController();
  const tAbort = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();
  try {
    const form = new FormData();
    for (const fp of filePaths) {
      const buffer = await fs.readFile(fp);
      const name = path.basename(fp);
      const file = new File([buffer], name, { type: "text/csv" });
      form.append("archivos", file, name);
    }
    form.append("formato", FORMATO);
    form.append("tipo", "auto");
    form.append("separador", "auto");
    form.append("diccionarioTipo", "rm");
    form.append("diccionarioNombre", QUERY_NAME);

    const res = await fetch(API_URL, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    const ms = Math.round(performance.now() - started);
    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = j?.error ?? "";
      } catch {
        detail = await res.text();
      }
      return { ok: false, ms, status: res.status, detail: String(detail).slice(0, 220), userId };
    }
    return {
      ok: true,
      ms,
      status: res.status,
      filas: Number(res.headers.get("X-Consolidador-Filas") || 0),
      columnas: Number(res.headers.get("X-Consolidador-Columnas") || 0),
      userId,
    };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    return {
      ok: false,
      ms,
      status: 0,
      detail: err?.name === "AbortError" ? "timeout/abort" : String(err),
      userId,
    };
  } finally {
    clearTimeout(tAbort);
  }
}

async function runBatch(concurrency, filePaths) {
  const started = performance.now();
  const tasks = Array.from({ length: concurrency }, (_, i) => postConsolidar(filePaths, i + 1));
  const results = await Promise.all(tasks);
  const totalMs = Math.round(performance.now() - started);
  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  const lat = results.map((r) => r.ms);
  return {
    concurrency,
    totalMs,
    ok: ok.length,
    fail: fail.length,
    successRate: Number(((ok.length / results.length) * 100).toFixed(1)),
    p50: Math.round(percentile(lat, 50)),
    p95: Math.round(percentile(lat, 95)),
    max: Math.max(...lat),
    failures: fail.slice(0, 4),
  };
}

async function main() {
  if (!DATA_DIR) {
    throw new Error(
      "Define CONSOLIDAR_DATA_DIR con una carpeta que contenga CSV de prueba.",
    );
  }
  console.log(`API: ${API_URL}`);
  console.log(`Data: ${DATA_DIR}`);
  console.log(`Formato: ${FORMATO} | Query: ${QUERY_NAME}`);
  const filePaths = await pickCsvFiles(DATA_DIR, 3);
  console.log("Archivos usados:");
  for (const p of filePaths) {
    console.log(` - ${p}`);
  }

  const report = [];
  for (const n of LADDER) {
    console.log(`\n[Batch] Concurrency=${n} ...`);
    const r = await runBatch(n, filePaths);
    report.push(r);
    console.log(
      `  ok=${r.ok} fail=${r.fail} success=${r.successRate}% total=${r.totalMs}ms p50=${r.p50}ms p95=${r.p95}ms max=${r.max}ms`,
    );
    if (r.failures.length) {
      for (const f of r.failures) {
        console.log(`  - fail#${f.userId} status=${f.status} ${f.detail}`);
      }
    }
  }

  const out = {
    timestamp: new Date().toISOString(),
    api: API_URL,
    dataDir: DATA_DIR,
    formato: FORMATO,
    ladder: LADDER,
    report,
  };
  const outPath = path.resolve("stress-report.json");
  await fs.writeFile(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`\nReporte JSON: ${outPath}`);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
