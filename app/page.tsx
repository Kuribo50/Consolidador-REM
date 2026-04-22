"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DropZone,
  FileTrigger,
  Input,
  Modal,
  ModalOverlay,
  ProgressBar,
  SearchField,
  Switch,
  Tab,
  TabList,
  Tabs,
  Tooltip,
  TooltipTrigger,
  isFileDropItem,
} from "react-aria-components";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Download,
  FileArchive,
  FileSpreadsheet,
  Info,
  Layers,
  Loader2,
  Moon,
  RefreshCw,
  Settings2,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { addToast } from "./components/toasts";

type Formato = "xlsx" | "csv";
type Estado = "idle" | "procesando" | "ok" | "error";
type FaseProgreso = "idle" | "subiendo" | "procesando" | "descargando";
type Tipo = "auto" | "rm" | "percapita";
type DiccionarioTipo = "rm" | "percapita";
type OrigenSeleccion = "none" | "auto" | "manual";

interface Resultado {
  id: string;
  filas: number;
  columnas: number;
  archivos: number;
  nombre: string;
  blob: Blob;
  formato: Formato;
  ms: number;
  createdAt: string;
  detalle: {
    columnasUnidas: number;
    columnasRenombradas: number;
    columnasFaltantes: number;
    columnasExtras: number;
    columnasSacadas: number;
    previewRenombradas: string;
    previewFaltantes: string;
    previewExtras: string;
  };
}

interface PreviewData {
  headers: string[];
  rows: string[][];
  mensaje?: string;
}

const DICCIONARIOS_RM = [
  "Censo Diario",
  "Estimacion Riesgo Ulceracion Del Pie 2",
  "Historico de Pacientes",
  "Libro de Partos",
  "prueba historico",
  "REGE-AtencionesIRAERA",
  "REGE-EnfermedadesNotificaciónObligatoria",
  "RM-AgendaPabellon",
  "RM-ApoyoPsicosocialHospitalizado",
  "RM-Atenciones-A01",
  "RM-Atenciones-A03",
  "RM-Atenciones-A04",
  "RM-Atenciones-A05",
  "RM-Atenciones-A06",
  "RM-Atenciones-A08",
  "RM-Atenciones-A19.A",
  "RM-Atenciones-A23",
  "RM-Atenciones-A26",
  "RM-Atenciones-A27",
  "RM-Atenciones-A28",
  "RM-Atenciones-A29",
  "RM-Atenciones-A32",
  "RM-Atenciones-BM18",
  "RM-AtencionesEvaluaciones-A01",
  "RM-AtencionesEvaluaciones-A03",
  "RM-AtencionesEvaluaciones-A05",
  "RM-AtencionesEvaluaciones-A06.A2",
  "RM-AtencionesEvaluaciones-A06.D",
  "RM-AtencionesEvaluaciones-A08",
  "RM-AtencionesEvaluaciones-A26",
  "RM-AtencionesEvaluaciones-A27",
  "RM-AtencionesEvaluaciones-A29",
  "RM-AtencionesEvaluaciones-B17",
  "RM-AtencionesEvaluaciones-BM18",
  "RM-AtencionesEvaluaciones2-A01",
  "RM-AtencionesEvaluaciones2-A03",
  "RM-AtencionesEvaluaciones2-A05",
  "RM-AtencionesEvaluaciones2-A06",
  "RM-AtencionesEvaluaciones2-A19.A",
  "RM-AtencionesEvaluaciones2-A24.G",
  "RM-AtencionesEvaluaciones2-A26",
  "RM-AtencionesEvaluaciones2-A28",
  "RM-AtencionesEvaluaciones2-A29",
  "RM-AtencionesEvaluaciones2-A32",
  "RM-AtencionesUrgenciaPorEspecialista",
  "RM-AtencionOdontologica",
  "RM-Capacitación",
  "RM-CensoMensual",
  "RM-CoberturaCAMujer",
  "RM-DatosAdminMensual-A04E",
  "RM-DatosAdminMensual-A04E1",
  "RM-DatosAdminMensual-A04K",
  "RM-DatosAdminMensual-A05F2",
  "RM-DatosAdminMensual-A06C1",
  "RM-DatosAdminMensual-A06C2",
  "RM-DatosAdminMensual-A08",
  "RM-DatosAdminMensual-A08J",
  "RM-DatosAdminMensual-A09K",
  "RM-DatosAdminMensual-A19aB1",
  "RM-DatosAdminMensual-A19aB2",
  "RM-DatosAdminMensual-A19aB3",
  "RM-DatosAdminMensual-A19aB4",
  "RM-DatosAdminMensual-A23G",
  "RM-DatosAdminMensual-A23H",
  "RM-DatosAdminMensual-A23M2",
  "RM-DatosAdminMensual-A24.A1",
  "RM-DatosAdminMensual-A27F",
  "RM-DatosAdminMensual-A27I",
  "RM-DatosAdminMensual-A27J",
  "RM-DatosAdminMensual-A28A12",
  "RM-DatosAdminMensual-A30.B",
  "RM-DatosAdminMensual-A30.C",
  "RM-DatosAdminMensual-A30.E",
  "RM-DatosAdminMensual-B17.J",
  "RM-DatosAdminMensual-B17.L",
  "RM-DatosAdminMensual-B17.M",
  "RM-DatosAdminMensual-BM18H",
  "RM-DatosAdminMensual-BM18J",
  "RM-DatosAdminMensual-D15F",
  "RM-DEISUrgencia",
  "RM-DistribucionPNAC-PACAM",
  "RM-EpisodiosUrgencia",
  "RM-ExamenMedicinaPreventiva",
  "RM-FamiliasBajoControl-P7",
  "RM-HospitalizacionDiurna-A06",
  "RM-HospitalizacionDomiciliaria2025",
  "RM-HospitalizadosBarthel-A03.D5",
  "RM-ListaEspera",
  "RM-Maternidad",
  "RM-NotificaciónRAM-A04",
  "RM-PBCSaludMentalEspecialidades",
  "RM-PesquisaEnfermedadesTransmisibles",
  "RM-PoblacionARO-P1",
  "RM-PoblacionBajoControl-P1",
  "RM-PoblacionBajoControl-P11",
  "RM-PoblacionBajoControl-P13",
  "RM-PoblacionBajoControl-P2",
  "RM-PoblacionBajoControl-P3",
  "RM-PoblacionBajoControl-P4",
  "RM-PoblacionBajoControl-P5",
  "RM-PoblacionBajoControl-P6",
  "RM-PoblacionBajoControl-P9",
  "RM-PoblacionBajoControlCitas-P13",
  "RM-PoblacionBajoControlCitas-P2",
  "RM-Prestaciones",
  "RM-PrestacionesProgramaRehabilitacionNivelHospitalario",
  "RM-ProduccionCitas",
  "RM-ProduccionFarmacia",
  "RM-ProduccionRescates",
  "RM-ProgramaRehabilitacionNivelHospitalario",
  "RM-ProtocoloOperatorio",
  "RM-SolicitudesHospitalizacion",
  "RM-StockPNACPACAM",
] as const;

const DICCIONARIOS_PERCAPITA = ["Percápita FONASA"] as const;

const DICCIONARIOS_IMPLEMENTADOS_RM = new Set<string>([
  "RM-Atenciones-A01",
  "RM-ProduccionCitas",
  "RM-EpisodiosUrgencia",
]);

const DICCIONARIOS_IMPLEMENTADOS_PERCAPITA = new Set<string>([
  "Percápita FONASA",
]);

function estaDisponible(tipo: DiccionarioTipo, nombre: string) {
  if (tipo === "rm") return DICCIONARIOS_IMPLEMENTADOS_RM.has(nombre);
  return DICCIONARIOS_IMPLEMENTADOS_PERCAPITA.has(nombre);
}

function fmtNum(n: number) {
  return n.toLocaleString("es-CL");
}

function fmtMs(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`;
}

function fmtSize(bytes: number) {
  if (bytes <= 0) return "0 MB";
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtElapsed(totalSeg: number) {
  const seg = Math.max(0, Math.floor(totalSeg));
  const min = Math.floor(seg / 60);
  const rest = seg % 60;
  return min > 0
    ? `${min}m ${String(rest).padStart(2, "0")}s`
    : `${seg}s`;
}

function fmtRestante(totalSeg: number) {
  const seg = Math.max(1, Math.round(totalSeg));
  if (seg >= 60) {
    const min = Math.floor(seg / 60);
    const rest = seg % 60;
    return `~${min}m ${String(rest).padStart(2, "0")}s`;
  }
  return `~${seg}s`;
}

function normalizarBusqueda(texto: string) {
  return texto
    .toLocaleLowerCase("es")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function esSubsecuencia(query: string, target: string) {
  let i = 0;
  let j = 0;
  while (i < query.length && j < target.length) {
    if (query[i] === target[j]) i += 1;
    j += 1;
  }
  return i === query.length;
}

function puntajeCoincidenciaDiccionario(nombre: string, queryRaw: string) {
  const query = normalizarBusqueda(queryRaw);
  if (!query) return 1;

  const nombreNorm = normalizarBusqueda(nombre);
  if (!nombreNorm) return 0;

  if (nombreNorm === query) return 1200;
  if (nombreNorm.startsWith(query))
    return 1000 - (nombreNorm.length - query.length);

  const idx = nombreNorm.indexOf(query);
  if (idx >= 0) return 880 - idx;

  const tokens = query.split(" ").filter(Boolean);
  let tokensEncontrados = 0;
  let tokenScore = 0;
  for (const t of tokens) {
    const pos = nombreNorm.indexOf(t);
    if (pos >= 0) {
      tokensEncontrados += 1;
      tokenScore += 140 - Math.min(pos, 120);
    }
  }
  if (tokensEncontrados === tokens.length && tokens.length > 0) {
    return 600 + tokenScore;
  }
  if (tokensEncontrados > 0) {
    return 320 + tokenScore;
  }

  const compactQ = query.replace(/\s+/g, "");
  const compactN = nombreNorm.replace(/\s+/g, "");
  if (compactQ.length >= 3 && esSubsecuencia(compactQ, compactN)) {
    return 220 - Math.max(0, compactN.length - compactQ.length);
  }

  return 0;
}

function extraerDiccionarioDesdeNombreArchivo(nombre: string): string | null {
  const base = (nombre || "").split(/[\\/]/).pop() || "";
  // Buscar patron RM-XXXX o simplemente palabras que coincidan con diccionarios conocidos
  const m = base.match(/(RM-[^._]+)(?:[._]|\.(?:csv|zip|xlsx)|$)/i);
  if (m) return m[1];
  
  // Si no hay prefijo RM-, buscar si el nombre del archivo contiene alguno de los dics conocidos
  // Ordenamos por longitud descendente para que los nombres mas especificos tengan prioridad
  const totalDics = [...DICCIONARIOS_RM, ...DICCIONARIOS_PERCAPITA].sort((a,b) => b.length - a.length);
  for (const d of totalDics) {
    const cleanDic = d.replace(/^(RM-|Percapita-)/i, "").toLowerCase();
    if (base.toLowerCase().includes(cleanDic)) return d;
  }
  return null;
}

function normalizarIdDiccionario(texto: string): string {
  return (texto || "")
    .toLocaleLowerCase("es")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function detectarDiccionarioDesdeArchivos(files: File[]): {
  tipo: DiccionarioTipo;
  nombre: string;
  mixed: boolean;
  detected: string[];
} | null {
  const encontrados = new Set<string>();
  for (const f of files) {
    const token = extraerDiccionarioDesdeNombreArchivo(f.name);
    if (token) encontrados.add(token);
  }

  const detected = Array.from(encontrados);
  if (detected.length === 0) return null;
  if (detected.length > 1)
    return { tipo: "rm", nombre: detected[0], mixed: true, detected };
  return { tipo: "rm", nombre: detected[0], mixed: false, detected };
}

function FileBadge({
  file,
  seleccionado,
  onToggle,
  onRemove,
  disabled = false,
}: {
  file: File;
  seleccionado: boolean;
  onToggle: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const isZip = file.name.endsWith(".zip");

  return (
    <div className="file-badge">
      <Checkbox
        className="file-check"
        isSelected={seleccionado}
        onChange={onToggle}
        isDisabled={disabled}
        aria-label={`Incluir ${file.name}`}
      >
        <span className="file-check-ui" aria-hidden="true" />
      </Checkbox>
      {isZip ? (
        <FileArchive size={14} className="icon-zip" />
      ) : (
        <FileSpreadsheet size={14} className="icon-csv" />
      )}
      <span className="file-name" title={file.name}>
        {file.name}
      </span>
      <span className="file-size">{fmtSize(file.size)}</span>
      <Button onPress={onRemove} isDisabled={disabled} aria-label={`Eliminar ${file.name}`}>
        <X size={12} />
      </Button>
    </div>
  );
}

export default function ConsolidadorPage() {
  const [archivos, setArchivos] = useState<File[]>([]);
  const [formato, setFormato] = useState<Formato>("csv");
  const [estado, setEstado] = useState<Estado>("idle");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [historialDescargas, setHistorialDescargas] = useState<Resultado[]>([]);
  const [error, setError] = useState("");
  const [filtroDiccionario, setFiltroDiccionario] = useState("");
  const [faseProgreso, setFaseProgreso] = useState<FaseProgreso>("idle");
  const [pctProgreso, setPctProgreso] = useState<number | null>(null);
  const [inicioProcesoMs, setInicioProcesoMs] = useState<number | null>(null);
  const [segundosTranscurridos, setSegundosTranscurridos] = useState(0);
  const [tipoDiccionario, setTipoDiccionario] = useState<DiccionarioTipo>("rm");
  const [diccionarioSeleccionado, setDiccionarioSeleccionado] =
    useState<string>("");
  const [origenSeleccion, setOrigenSeleccion] =
    useState<OrigenSeleccion>("none");
  const [mensajeDeteccion, setMensajeDeteccion] = useState<string>("");
  const [descargasAbiertas, setDescargasAbiertas] = useState(false);
  const [archivosSeleccionados, setArchivosSeleccionados] = useState<
    Set<string>
  >(new Set());
  const [separador, setSeparador] = useState("auto");
  const [autoDeteccion, setAutoDeteccion] = useState(true);
  const [modoNoche, setModoNoche] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [mostrarDialogoPostDescarga, setMostrarDialogoPostDescarga] = useState(false);
  const descargasRef = useRef<HTMLDivElement>(null);
  const consolidacionEnCursoRef = useRef(false);
  const xhrEnCursoRef = useRef<XMLHttpRequest | null>(null);
  const canceladoPorUsuarioRef = useRef(false);
  const resultadosPreviosRef = useRef<Resultado[]>([]);
  const uiBloqueada = estado === "procesando";

  const totalBytes = archivos.reduce((suma, file) => suma + file.size, 0);
  const resultadosOrdenados = [...historialDescargas].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const ultimoResultado = [...resultados].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0] ?? null;
  const diccionariosBase = (
    tipoDiccionario === "rm"
      ? [...DICCIONARIOS_RM]
      : [...DICCIONARIOS_PERCAPITA]
  ).sort((a, b) => {
    const dispA = estaDisponible(tipoDiccionario, a);
    const dispB = estaDisponible(tipoDiccionario, b);
    if (dispA !== dispB) return dispA ? -1 : 1;
    return a.localeCompare(b, "es");
  });
  const diccionariosDisponibles = diccionariosBase.filter((item) =>
    estaDisponible(tipoDiccionario, item),
  );
  const diccionariosFiltrados = diccionariosBase
    .map((item) => ({
      item,
      score: puntajeCoincidenciaDiccionario(item, filtroDiccionario),
      disponible: estaDisponible(tipoDiccionario, item),
    }))
    .filter((x) => (filtroDiccionario.trim() ? x.score > 0 : true))
    .sort((a, b) => {
      if (a.disponible !== b.disponible) return a.disponible ? -1 : 1;
      if (a.score !== b.score) return b.score - a.score;
      return a.item.localeCompare(b.item, "es");
    })
    .map((x) => x.item);
  const disponiblesTotal = diccionariosBase.filter((item) =>
    estaDisponible(tipoDiccionario, item),
  ).length;
  const disponiblesFiltrados = diccionariosFiltrados.filter((item) =>
    estaDisponible(tipoDiccionario, item),
  ).length;
  const tipoEfectivo: Tipo = diccionarioSeleccionado ? tipoDiccionario : "auto";
  const acceptEfectivo = diccionarioSeleccionado
    ? tipoDiccionario === "percapita"
      ? ".csv"
      : ".csv,.zip"
    : ".csv,.zip";
  const cantidadSeleccionada = Array.from(archivosSeleccionados).filter(
    (name) => archivos.some((f) => f.name === name),
  ).length;
  const conflictoDiccionariosSeleccionados = (() => {
    const seleccionados = archivos.filter((f) => archivosSeleccionados.has(f.name));
    const tokens = new Set<string>();
    for (const f of seleccionados) {
      const token = extraerDiccionarioDesdeNombreArchivo(f.name);
      if (token) tokens.add(token);
    }
    const encontrados = Array.from(tokens);
    return {
      hayConflicto: encontrados.length > 1,
      encontrados,
    };
  })();
  const incompatibilidadDiccionarioSeleccionado = (() => {
    if (!diccionarioSeleccionado) {
      return { hayIncompatibilidad: false, encontrados: [] as string[] };
    }
    const seleccionados = archivos.filter((f) => archivosSeleccionados.has(f.name));
    const tokens = new Set<string>();
    for (const f of seleccionados) {
      const token = extraerDiccionarioDesdeNombreArchivo(f.name);
      if (token) tokens.add(token);
    }
    const encontrados = Array.from(tokens);
    if (!encontrados.length) {
      return { hayIncompatibilidad: false, encontrados };
    }
    const esperado = normalizarIdDiccionario(diccionarioSeleccionado);
    const hayIncompatibilidad = encontrados.some(
      (t) => normalizarIdDiccionario(t) !== esperado,
    );
    return { hayIncompatibilidad, encontrados };
  })();
  // Tiempo total estimado según formato y tamaño de entrada.
  // Con Polars: lectura es ~instantánea; el cuello de botella real es la escritura Excel.
  // Empírico: ~1.4 s/MB para xlsx, ~0.015 s/MB para csv.
  const segsEstimadosExcel = (() => {
    const mb = totalBytes / 1024 / 1024;
    return Math.max(8, mb * 1.4 + archivos.length * 0.5);
  })();
  const segsEstimadosTotal = (() => {
    const mb = totalBytes / 1024 / 1024;
    if (formato === "csv") return Math.max(2, mb * 0.015 + archivos.length * 0.1);
    return segsEstimadosExcel;
  })();

  const progresoGlobal = (() => {
    if (estado !== "procesando") return 0;

    if (faseProgreso === "subiendo") {
      return pctProgreso === null
        ? 5
        : Math.max(1, Math.min(20, Math.round(pctProgreso * 0.2)));
    }

    if (faseProgreso === "procesando") {
      const t = Math.min(1, segundosTranscurridos / segsEstimadosTotal);
      return Math.min(90, 20 + Math.round(t * 70));
    }

    if (faseProgreso === "descargando") {
      return pctProgreso === null
        ? 95
        : Math.max(90, Math.min(99, 90 + Math.round(pctProgreso * 0.09)));
    }

    return 25;
  })();

  const segundosRestantesEstimados = (() => {
    if (estado !== "procesando") return null;
    if (faseProgreso !== "procesando") return null;
    const faltante = segsEstimadosTotal - segundosTranscurridos;
    return Math.max(0, Math.round(faltante));
  })();
  const faseTexto =
    faseProgreso === "subiendo"
      ? "Subiendo archivos"
      : faseProgreso === "procesando"
        ? "Procesando consolidado"
        : faseProgreso === "descargando"
          ? "Preparando descarga"
          : "Procesando";
  const progresoDetalleBase =
    faseProgreso === "subiendo"
      ? "Validando archivos y enviando al servidor."
      : faseProgreso === "procesando"
        ? "Aplicando query, unificando columnas y consolidando datos."
        : faseProgreso === "descargando"
          ? "Empaquetando resultado final para descarga."
          : "Esperando inicio.";
  const progresoDetalleTexto =
    estado === "procesando" && formato === "xlsx"
      ? `${progresoDetalleBase} Excel puede demorar el doble en la exportación.`
      : progresoDetalleBase;
  const tiempoTranscurridoTexto =
    estado === "procesando"
      ? fmtElapsed(segundosTranscurridos)
      : ultimoResultado
        ? fmtMs(ultimoResultado.ms)
        : "0s";
  const tiempoRestanteTexto =
    segundosRestantesEstimados !== null ? fmtRestante(segundosRestantesEstimados) : "—";

  useEffect(() => {
    try {
      const saved = localStorage.getItem("consolidador_theme");
      if (saved === "dark") setModoNoche(true);
    } catch {}
  }, []);

  useEffect(() => {
    const body = document.body;
    body.classList.toggle("theme-dark", modoNoche);
    try {
      localStorage.setItem("consolidador_theme", modoNoche ? "dark" : "light");
    } catch {}
  }, [modoNoche]);

  const buildCsvPreview = (text: string): PreviewData => {
    const limpio = text.replace(/^\uFEFF/, "");
    const lineas = limpio.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (!lineas.length) {
      return { headers: [], rows: [], mensaje: "El archivo no contiene datos." };
    }
    const headers = lineas[0].split(";");
    const rows = lineas.slice(1, 8).map((l) => l.split(";").map((c) => c.trim()));
    return { headers, rows };
  };

  const buildXlsxPreview = async (blob: Blob): Promise<PreviewData> => {
    const XLSX = await import("xlsx");
    const buffer = await blob.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { headers: [], rows: [], mensaje: "El archivo Excel no contiene hojas." };
    }
    const sheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      blankrows: false,
      raw: false,
      defval: "",
    });
    if (!matrix.length) {
      return { headers: [], rows: [], mensaje: "El archivo Excel no contiene datos." };
    }
    const headers = (matrix[0] ?? []).map((v) => String(v ?? ""));
    const rows = matrix
      .slice(1, 8)
      .map((row) => headers.map((_, idx) => String((row ?? [])[idx] ?? "")));
    return { headers, rows };
  };

  useEffect(() => {
    let mounted = true;
    const buildPreview = async () => {
      if (!ultimoResultado) {
        setPreview(null);
        return;
      }
      setPreviewLoading(true);
      try {
        let parsed: PreviewData;
        if (ultimoResultado.formato === "csv") {
          const text = await ultimoResultado.blob.text();
          parsed = buildCsvPreview(text);
        } else {
          parsed = await buildXlsxPreview(ultimoResultado.blob);
        }
        if (!mounted) return;
        setPreview(parsed);
      } catch {
        if (!mounted) return;
        setPreview({
          headers: [],
          rows: [],
          mensaje: "No fue posible generar la previsualización del archivo.",
        });
      } finally {
        if (mounted) setPreviewLoading(false);
      }
    };
    buildPreview();
    return () => {
      mounted = false;
    };
  }, [ultimoResultado]);

  const resetFormulario = useCallback(() => {
    setEstado("idle");
    setError("");
    setFaseProgreso("idle");
    setPctProgreso(null);
    setInicioProcesoMs(null);
    setSegundosTranscurridos(0);
    setArchivos([]);
    setArchivosSeleccionados(new Set());
    setFormato("csv");
    setSeparador("auto");
    setTipoDiccionario("rm");
    setFiltroDiccionario("");
    setDiccionarioSeleccionado("");
    setOrigenSeleccion("none");
    setMensajeDeteccion("");
    setFaseProgreso("idle");
    setPctProgreso(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const limpiarTodo = useCallback(() => {
    setResultados([]);
    setDescargasAbiertas(false);
    resetFormulario();
  }, [resetFormulario]);

  const agregarArchivos = useCallback(
    (nuevos: File[]) => {
      // Si no hay diccionario elegido, permitir ZIP/CSV para que la deteccion automatica funcione.
      const validos = nuevos.filter((f) => {
        const lower = f.name.toLowerCase();
        const isCsv = lower.endsWith(".csv");
        const isZip = lower.endsWith(".zip");
        if (diccionarioSeleccionado && tipoDiccionario === "percapita")
          return isCsv;
        return isCsv || isZip;
      });
      if (validos.length) setEstado("idle");
      setArchivos((prev) => {
        const nombres = new Set(prev.map((f) => f.name));
        const agregados = validos.filter((f) => !nombres.has(f.name));
        if (agregados.length) {
          setError("");
          setArchivosSeleccionados((prevSel) => {
            const next = new Set(prevSel);
            for (const f of agregados) next.add(f.name);
            return next;
          });
        }
        return [...prev, ...agregados];
      });
    },
    [diccionarioSeleccionado, tipoDiccionario],
  );

  useEffect(() => {
    if (!autoDeteccion || !archivos.length) {
      setMensajeDeteccion("");
      return;
    }

    const det = detectarDiccionarioDesdeArchivos(archivos);
    if (!det) {
      setMensajeDeteccion("");
      return;
    }

    if (det.mixed) {
      setMensajeDeteccion(
        `Se detectaron queries distintas en los archivos: ${det.detected.join(", ")}. Deja una sola query para continuar.`,
      );
      return;
    }

    const nombre = det.nombre;
    const disponible = estaDisponible("rm", nombre);

    if (!disponible) {
      setMensajeDeteccion(
        `Query detectada en archivos: ${nombre} (aún no disponible).`,
      );
      return;
    }

    // Si el usuario ya eligio manualmente, no pisar su seleccion.
    if (
      origenSeleccion === "manual" &&
      diccionarioSeleccionado &&
      diccionarioSeleccionado !== nombre
    ) {
      setMensajeDeteccion(
        `Query detectada en archivos: ${nombre}. (Se mantiene tu selección manual)`,
      );
      return;
    }

    if (diccionarioSeleccionado !== nombre || tipoDiccionario !== "rm") {
      setTipoDiccionario("rm");
      setDiccionarioSeleccionado(nombre);
      setOrigenSeleccion("auto");
    }

    setMensajeDeteccion(`Query detectada en archivos: ${nombre}.`);
  }, [archivos, diccionarioSeleccionado, origenSeleccion, tipoDiccionario, autoDeteccion]);

  useEffect(() => {
    if (estado !== "procesando" || inicioProcesoMs === null) {
      setSegundosTranscurridos(0);
      return;
    }
    const sync = () => {
      setSegundosTranscurridos(
        Math.max(0, Math.floor((Date.now() - inicioProcesoMs) / 1000)),
      );
    };
    sync();
    const id = window.setInterval(sync, 1000);
    return () => window.clearInterval(id);
  }, [estado, inicioProcesoMs]);

  useEffect(() => {
    if (!descargasAbiertas) return;

    const onDocClick = (event: MouseEvent) => {
      if (!descargasRef.current) return;
      if (!descargasRef.current.contains(event.target as Node)) {
        setDescargasAbiertas(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDescargasAbiertas(false);
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [descargasAbiertas]);

  const onFileSelect = useCallback(
    (fileList: FileList | null) => {
      if (uiBloqueada || !fileList) return;
      agregarArchivos(Array.from(fileList));
    },
    [agregarArchivos, uiBloqueada],
  );

  const onDrop = useCallback(
    async (e: { items: unknown[] }) => {
      if (uiBloqueada) return;
      const files: File[] = [];
      for (const item of e.items) {
        const dropItem = item as Parameters<typeof isFileDropItem>[0];
        if (isFileDropItem(dropItem)) {
          const f = await dropItem.getFile();
          if (f) files.push(f);
        }
      }
      if (files.length) agregarArchivos(files);
    },
    [agregarArchivos, uiBloqueada],
  );

  const remover = (idx: number) => {
    setArchivos((prev) => {
      const file = prev[idx];
      if (file) {
        setArchivosSeleccionados((prevSel) => {
          const next = new Set(prevSel);
          next.delete(file.name);
          return next;
        });
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const toggleArchivo = useCallback((nombre: string) => {
    setArchivosSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });
  }, []);

  const descargarResultado = useCallback((resultado: Resultado) => {
    const url = URL.createObjectURL(resultado.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = resultado.nombre;
    a.click();
    URL.revokeObjectURL(url);
    setDescargasAbiertas(false);
    setMostrarDialogoPostDescarga(true);
  }, []);

  const limpiarHistorial = useCallback(() => {
    setHistorialDescargas([]);
    setDescargasAbiertas(false);
  }, []);

  const cancelarConsolidacion = useCallback(() => {
    if (!uiBloqueada) return;
    canceladoPorUsuarioRef.current = true;
    xhrEnCursoRef.current?.abort();
    xhrEnCursoRef.current = null;
    consolidacionEnCursoRef.current = false;
    setResultados([]);
    setEstado("idle");
    setFaseProgreso("idle");
    setPctProgreso(null);
    setInicioProcesoMs(null);
    setSegundosTranscurridos(0);
    addToast({
      title: "Consolidación cancelada",
      description: "Puedes ajustar la configuración y volver a intentar.",
      variant: "info",
    });
  }, [uiBloqueada]);

  const consolidar = async () => {
    if (consolidacionEnCursoRef.current || uiBloqueada) return;
    if (conflictoDiccionariosSeleccionados.hayConflicto) {
      const detalle = conflictoDiccionariosSeleccionados.encontrados.join(", ");
      const msg = `No se puede consolidar: hay archivos de queries distintas (${detalle}).`;
      setError(msg);
      setEstado("error");
      addToast({
        title: "Tipos de archivo mezclados",
        description: msg,
        variant: "error",
      });
      return;
    }
    if (incompatibilidadDiccionarioSeleccionado.hayIncompatibilidad) {
      const detectado = incompatibilidadDiccionarioSeleccionado.encontrados.join(", ");
      const msg = `Los archivos seleccionados no coinciden con la query elegida (${diccionarioSeleccionado}). Detectado en archivos: ${detectado}. Elige la query correspondiente o cambia los archivos.`;
      setError(msg);
      setEstado("error");
      addToast({
        title: "Query no coincide",
        description: msg,
        variant: "error",
      });
      return;
    }
    const archivosAEnviar = archivos.filter((f) =>
      archivosSeleccionados.has(f.name),
    );
    if (!archivosAEnviar.length) return;
    consolidacionEnCursoRef.current = true;
    resultadosPreviosRef.current = resultados;
    setResultados([]);

    setEstado("procesando");
    setError("");
    setFaseProgreso("subiendo");
    setPctProgreso(0);
    setInicioProcesoMs(Date.now());
    setSegundosTranscurridos(0);

    const fd = new FormData();
    archivosAEnviar.forEach((f) => fd.append("archivos", f));
    fd.append("formato", formato);
    fd.append("tipo", "auto");
    fd.append("separador", separador);
    if (diccionarioSeleccionado) {
      fd.append("diccionarioTipo", tipoDiccionario);
      fd.append("diccionarioNombre", diccionarioSeleccionado);
    }

    const t0 = performance.now();

    try {
      canceladoPorUsuarioRef.current = false;
      const { blob, headers, ms } = await new Promise<{
        blob: Blob;
        headers: Record<string, string>;
        ms: number;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrEnCursoRef.current = xhr;
        xhr.open("POST", "/api/consolidar");
        xhr.responseType = "blob";

        xhr.upload.onprogress = (e) => {
          setFaseProgreso("subiendo");
          if (e.lengthComputable && e.total > 0) {
            setPctProgreso(
              Math.max(
                0,
                Math.min(100, Math.round((e.loaded / e.total) * 100)),
              ),
            );
          } else {
            setPctProgreso(null);
          }
        };

        xhr.upload.onload = () => {
          // Upload completo; el backend puede seguir procesando antes de responder.
          setFaseProgreso("procesando");
          setPctProgreso(null);
        };

        xhr.onprogress = (e) => {
          // Si el backend ya esta respondiendo, esto corresponde a la descarga del archivo generado.
          if (xhr.readyState >= 3) {
            setFaseProgreso("descargando");
            if (e.lengthComputable && e.total > 0) {
              setPctProgreso(
                Math.max(
                  0,
                  Math.min(100, Math.round((e.loaded / e.total) * 100)),
                ),
              );
            } else {
              setPctProgreso(null);
            }
          }
        };

        xhr.onerror = () => {
          if (canceladoPorUsuarioRef.current) {
            reject(new Error("__cancelado__"));
            return;
          }
          reject(new Error("Error de red al consolidar"));
        };

        xhr.onabort = () => {
          reject(new Error("__cancelado__"));
        };

        xhr.onload = async () => {
          const elapsed = Math.round(performance.now() - t0);

          const headersObj: Record<string, string> = {};
          for (const key of [
            "X-Consolidador-Filas",
            "X-Consolidador-Columnas",
            "X-Consolidador-Archivos",
            "X-Consolidador-Nombre",
            "X-Consolidador-Cols-Unidas",
            "X-Consolidador-Cols-Renombradas",
            "X-Consolidador-Cols-Faltantes",
            "X-Consolidador-Cols-Extras",
            "X-Consolidador-Cols-Sacadas",
            "X-Consolidador-Preview-Renombradas",
            "X-Consolidador-Preview-Faltantes",
            "X-Consolidador-Preview-Extras",
          ]) {
            const v = xhr.getResponseHeader(key);
            if (v) headersObj[key] = v;
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({
              blob: xhr.response as Blob,
              headers: headersObj,
              ms: elapsed,
            });
            return;
          }

          let mensaje = `HTTP ${xhr.status}`;
          try {
            const text = await (xhr.response as Blob).text();
            const j = JSON.parse(text) as { error?: string };
            if (j?.error) mensaje = j.error;
          } catch {
            // ignore
          }
          reject(new Error(mensaje));
        };

        xhr.send(fd);
      });

      const nuevoResultado: Resultado = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        filas: Number(headers["X-Consolidador-Filas"] || 0),
        columnas: Number(headers["X-Consolidador-Columnas"] || 0),
        archivos: Number(headers["X-Consolidador-Archivos"] || 0),
        nombre: headers["X-Consolidador-Nombre"] || `consolidado.${formato}`,
        blob,
        formato,
        ms,
        createdAt: new Date().toISOString(),
        detalle: {
          columnasUnidas: Number(headers["X-Consolidador-Cols-Unidas"] || 0),
          columnasRenombradas: Number(headers["X-Consolidador-Cols-Renombradas"] || 0),
          columnasFaltantes: Number(headers["X-Consolidador-Cols-Faltantes"] || 0),
          columnasExtras: Number(headers["X-Consolidador-Cols-Extras"] || 0),
          columnasSacadas: Number(headers["X-Consolidador-Cols-Sacadas"] || 0),
          previewRenombradas: headers["X-Consolidador-Preview-Renombradas"]
            ? decodeURIComponent(headers["X-Consolidador-Preview-Renombradas"])
            : "",
          previewFaltantes: headers["X-Consolidador-Preview-Faltantes"]
            ? decodeURIComponent(headers["X-Consolidador-Preview-Faltantes"])
            : "",
          previewExtras: headers["X-Consolidador-Preview-Extras"]
            ? decodeURIComponent(headers["X-Consolidador-Preview-Extras"])
            : "",
        },
      };

      setResultados((prev) => [nuevoResultado, ...prev]);
      setHistorialDescargas((prev) => [nuevoResultado, ...prev]);
      setEstado("ok");
      setFaseProgreso("idle");
      setPctProgreso(null);
      setInicioProcesoMs(null);

      addToast({
        title: "Consolidación completada",
        description: `${nuevoResultado.filas.toLocaleString("es-CL")} filas · ${nuevoResultado.columnas} columnas · ${nuevoResultado.archivos} archivos · ${(ms / 1000).toFixed(1)} s`,
        variant: "success",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al consolidar";
      if (msg === "__cancelado__") {
        setResultados([]);
        return;
      }
      setResultados(resultadosPreviosRef.current);
      setError(msg);
      setEstado("error");
      setFaseProgreso("idle");
      setPctProgreso(null);
      setInicioProcesoMs(null);

      addToast({
        title: "Error al procesar",
        description: msg.length > 120 ? msg.slice(0, 117) + "…" : msg,
        variant: "error",
      });
    } finally {
      xhrEnCursoRef.current = null;
      canceladoPorUsuarioRef.current = false;
      consolidacionEnCursoRef.current = false;
    }
  };

  return (
    <main className="page">
      <header className="header">
        <div className="header-inner">
          <div className="logo-group">
            <div className="logo-mark">
              <img
                src="/logo_disamjulio2025B.png"
                alt="Logo Alberto Reyes"
              />
            </div>
            <div>
              <h1 className="site-title">Consolidador</h1>
              <p className="site-sub">CESFAM Dr. Alberto Reyes</p>
            </div>
          </div>
          <div className="header-actions">
            <Switch
              className="auto-switch header-theme-switch"
              isSelected={modoNoche}
              onChange={setModoNoche}
              aria-label="Activar modo noche"
            >
              {modoNoche ? <Moon size={14} /> : <Sun size={14} />}
              <span>{modoNoche ? "Noche" : "Claro"}</span>
            </Switch>
            <div
              className={`downloads-nav ${descargasAbiertas ? "open" : ""}`}
              ref={descargasRef}
            >
              <Button
                className="downloads-nav-trigger"
                onPress={() => setDescargasAbiertas((prev) => !prev)}
                aria-label="Abrir historial de descargas"
                aria-expanded={descargasAbiertas}
              >
                <div className="downloads-nav-trigger-inner">
                  <Download size={16} />
                  <span>Descargas</span>
                </div>
                <span className="downloads-nav-count">
                  {resultadosOrdenados.length}
                </span>
              </Button>

              {descargasAbiertas && (
                <div
                  className="downloads-nav-menu"
                  role="menu"
                  aria-label="Historial de descargas"
                >
                  <div className="downloads-nav-header">
                    <strong>Consolidados generados</strong>
                    <span>{resultadosOrdenados.length} total</span>
                  </div>
                  {resultadosOrdenados.length === 0 ? (
                    <p className="downloads-nav-empty">
                      No hay descargas disponibles aún.
                    </p>
                  ) : (
                    <div className="downloads-nav-list">
                      {resultadosOrdenados.map((item, index) => (
                        <Button
                          key={item.id}
                          className={`downloads-nav-item ${index === 0 ? "recent" : ""}`}
                          onPress={() => descargarResultado(item)}
                          aria-label={`Descargar nuevamente ${item.nombre}`}
                        >
                          <span
                            className="downloads-nav-name"
                            title={item.nombre}
                          >
                            {item.nombre}
                          </span>
                          <span className="downloads-nav-meta">
                            {item.formato.toUpperCase()} ·{" "}
                            {fmtFecha(item.createdAt)}
                          </span>
                        </Button>
                      ))}
                    </div>
                  )}
                  {resultadosOrdenados.length > 0 && (
                    <Button
                      className="downloads-nav-clear"
                      onPress={limpiarHistorial}
                      aria-label="Limpiar historial de descargas"
                    >
                      Limpiar historial
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar" aria-label="Panel lateral de control">
          <section className="card nav-card">
            <div className="card-header">
              <RefreshCw size={13} />
              <span>Sesión</span>
            </div>
            <Button
              className="nav-item nav-item-danger"
              onPress={limpiarTodo}
              isDisabled={uiBloqueada}
              aria-label="Reiniciar toda la sesión"
            >
              <div className="nav-item-inner">
                <Trash2 size={14} />
                <span>Limpiar todo</span>
              </div>
            </Button>
          </section>

          <section className="card sidebar-config">
            <div className="card-header">
              <Settings2 size={13} />
              <span>Seleccione tipo de archivo</span>
            </div>

            <div className="dict-panel">
              <Tabs
                selectedKey={tipoDiccionario}
                onSelectionChange={(key) => {
                  const selected = key === "percapita" ? "percapita" : "rm";
                  setTipoDiccionario(selected);
                  setDiccionarioSeleccionado("");
                  setOrigenSeleccion("manual");
                  setFiltroDiccionario("");
                }}
                isDisabled={uiBloqueada}
              >
                <TabList className="dict-tabs" aria-label="Tipo de query">
                  <Tab id="rm" className="dict-tab">RM</Tab>
                  <Tab id="percapita" className="dict-tab">Percápita</Tab>
                </TabList>
              </Tabs>

              <SearchField
                aria-label="Buscar query"
                className="dict-search-wrap"
                isDisabled={uiBloqueada}
                value={filtroDiccionario}
                onChange={setFiltroDiccionario}
              >
                <Input className="dict-search" placeholder="Buscar query..." />
              </SearchField>

              <div className="dict-list" role="list">
                {diccionariosFiltrados.map((item) => {
                  const selected = diccionarioSeleccionado === item;
                  const disponible = estaDisponible(tipoDiccionario, item);
                  return (
                    <Button
                      key={item}
                      className={`dict-item ${selected ? "selected" : ""}`}
                      onPress={() => {
                        setDiccionarioSeleccionado(item);
                        setOrigenSeleccion("manual");
                      }}
                      isDisabled={!disponible || uiBloqueada}
                    >
                      <span className="dict-item-text">{item}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="sidebar-bottom">
              <div className="format-label-row">
                <label className="field-label">Formato de salida</label>
                <TooltipTrigger delay={140}>
                  <Button className="format-info-trigger" aria-label="Información sobre formatos">
                    <Info size={12} />
                  </Button>
                  <Tooltip className="format-info-bubble">
                    <strong>CSV</strong> - instantáneo, se abre en Excel.{"\n"}
                    <strong>Excel</strong> - puede demorar el doble en la exportación.{"\n"}
                    Aprox: {fmtRestante(Math.round(segsEstimadosExcel))}.
                  </Tooltip>
                </TooltipTrigger>
              </div>
              <div className="btn-group" role="group" aria-label="Formato de salida">
                <Button
                  className={`seg-btn ${formato === "csv" ? "active" : ""}`}
                  isDisabled={uiBloqueada}
                  onPress={() => setFormato("csv")}
                >
                  CSV
                </Button>
                <Button
                  className={`seg-btn ${formato === "xlsx" ? "active" : ""}`}
                  isDisabled={uiBloqueada}
                  onPress={() => setFormato("xlsx")}
                >
                  Excel
                </Button>
              </div>

              <label className="field-label mt">Separador CSV</label>
              <div className="btn-group" role="group" aria-label="Separador CSV">
                {(["auto", "~", ";", ","] as const).map((s) => (
                  <Button
                    key={s}
                    className={`seg-btn ${separador === s ? "active" : ""}`}
                    isDisabled={uiBloqueada}
                    onPress={() => setSeparador(s)}
                  >
                    {s === "auto" ? "Auto" : s}
                  </Button>
                ))}
              </div>
              {uiBloqueada && (
                <p className="sidebar-lock-note" aria-live="polite">
                  Configuración bloqueada mientras se consolida.
                </p>
              )}
            </div>
          </section>
          <div className="sidebar-version" aria-label="Versión de la aplicación">
            v.0002
          </div>
        </aside>

        <div className="main-panel">
          <div className="summary-top-row">
          <section className="summary-banner summary-banner-half" aria-label="Resumen general">
            <div className="summary-banner-head">
              <div className="summary-banner-title">
                <BarChart3 size={16} />
                <span>Resumen</span>
              </div>

              <div className="summary-banner-tools">
                <Switch
                  isSelected={autoDeteccion}
                  onChange={setAutoDeteccion}
                  isDisabled={uiBloqueada}
                  className="auto-switch"
                >
                  Detección automática
                </Switch>

                <span className="summary-banner-dict">
                  Query:{" "}
                  <strong>{diccionarioSeleccionado || "Sin seleccionar"}</strong>
                </span>
              </div>
            </div>

            <div className="summary-plain-grid">
              <div className="summary-plain-row">
                <span className="summary-k">Query</span>
                <strong className="summary-v">{diccionarioSeleccionado || "Sin seleccionar"}</strong>
              </div>
              <div className="summary-plain-row">
                <span className="summary-k">Formato</span>
                <strong className="summary-v">{formato.toUpperCase()}</strong>
              </div>
              <div className="summary-plain-row">
                <span className="summary-k">Estado</span>
                <strong className="summary-v">{estado === "procesando" ? "Procesando" : estado === "ok" ? "Listo" : "En espera"}</strong>
              </div>
              <div className="summary-plain-row">
                <span className="summary-k">Registros</span>
                <strong className="summary-v">{fmtNum(ultimoResultado?.filas ?? 0)}</strong>
              </div>
              <div className="summary-plain-row">
                <span className="summary-k">Columnas</span>
                <strong className="summary-v">{ultimoResultado?.columnas ?? 0}</strong>
              </div>
              <div className="summary-plain-row">
                <span className="summary-k">Archivos</span>
                <strong className="summary-v">{ultimoResultado?.archivos ?? cantidadSeleccionada}</strong>
              </div>
              <div className="summary-plain-row">
                <span className="summary-k">Tamaño</span>
                <strong className="summary-v">{fmtSize(totalBytes)}</strong>
              </div>
              <div className="summary-plain-row">
                <span className="summary-k">Tiempo</span>
                <strong className="summary-v">
                  {ultimoResultado ? fmtMs(ultimoResultado.ms) : tiempoTranscurridoTexto}
                </strong>
              </div>
            </div>

            <div className="summary-footer-info summary-footer-tight">
              <span>
                <strong>Auto:</strong> query y separador
              </span>
              {mensajeDeteccion && (
                <span className="summary-detect-msg" aria-live="polite">
                  {mensajeDeteccion}
                </span>
              )}
            </div>
          </section>
          <section className="summary-progress-side" aria-label="Progreso de consolidación">
            <div className="progress-head">
              <span className="progress-title">
                {estado === "procesando" ? faseTexto : "En espera"}
              </span>
              <span className="progress-pct">{progresoGlobal}%</span>
            </div>
            <span className="sr-only" aria-live="polite" aria-atomic="true">
              {estado === "procesando"
                ? `${faseTexto}. Progreso ${progresoGlobal} por ciento.`
                : "Sin proceso activo."}
            </span>
            <p className="progress-stage-msg" aria-live="polite" aria-atomic="true">
              {progresoDetalleTexto}
            </p>
            {estado === "procesando" && (
              <div className="progress-hints">
                <span className="progress-hint-chip">Etapa: {faseTexto}</span>
                {formato === "xlsx" && (
                  <span className="progress-hint-chip warning">
                    Excel puede demorar el doble en la exportación (aprox:{" "}
                    {fmtRestante(
                      Math.round(
                        segundosRestantesEstimados !== null
                          ? segundosRestantesEstimados
                          : segsEstimadosExcel,
                      ),
                    )}
                    )
                  </span>
                )}
              </div>
            )}
            <ProgressBar
              aria-label="Barra de progreso"
              value={progresoGlobal}
              className="progress-bar-ra"
            >
              {({ percentage }) => (
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${estado === "procesando" ? "animated" : ""}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              )}
            </ProgressBar>
            <div className="progress-time-grid">
              <div className="progress-time-item">
                <span className="progress-time-label">Transcurrido</span>
                <strong>{fmtElapsed(segundosTranscurridos)}</strong>
              </div>
              <div className="progress-time-item">
                <span className="progress-time-label">Restante (est.)</span>
                <strong>{tiempoRestanteTexto}</strong>
              </div>
            </div>
            {estado === "procesando" && (
              <div className="summary-progress-actions">
                <Button
                  className="btn-cancel btn-cancel-full"
                  onPress={cancelarConsolidacion}
                  aria-label="Cancelar consolidación en curso"
                  style={{ width: "100%", display: "flex" }}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </section>
          </div>

          <div className="workflow-grid">
            {/* Left Column: Actions */}
            <div className="workflow-left">
              <DropZone
                className={`drop-zone ${archivos.length ? "has-files" : ""}`}
                aria-label="Zona de carga de archivos"
                isDisabled={uiBloqueada}
                onDrop={onDrop}
              >
                <FileTrigger
                  acceptedFileTypes={acceptEfectivo.split(",")}
                  allowsMultiple
                  onSelect={onFileSelect}
                >
                  <Button className="dropzone-trigger" isDisabled={uiBloqueada}>
                    <div className="drop-content">
                      <div className="drop-icon drop-icon-lg">
                        <Upload size={32} />
                      </div>
                      <p className="drop-title drop-title-lg">
                        {archivos.length ? "Añadir más archivos" : "Arrastra o selecciona archivos"}
                      </p>
                      <p className="drop-sub drop-sub-lg">
                        {tipoDiccionario === "percapita"
                          ? "CSV Percápita (FONASA)"
                          : "CSV y ZIP del Portal TrakCare"}
                      </p>
                      <p className="drop-hint">Haz clic en cualquier parte o arrastra archivos aquí</p>
                    </div>
                  </Button>
                </FileTrigger>
              </DropZone>

              <div className="action-row">
                <Button
                  className={`btn-consolidar ${estado === "procesando" ? "loading" : ""}`}
                  onPress={consolidar}
                  isDisabled={
                    !diccionarioSeleccionado ||
                    !archivos.length ||
                    cantidadSeleccionada === 0 ||
                    estado === "procesando" ||
                    conflictoDiccionariosSeleccionados.hayConflicto ||
                    incompatibilidadDiccionarioSeleccionado.hayIncompatibilidad
                  }
                  aria-label="Consolidar archivos cargados"
                >
                  {estado === "procesando" ? (
                    <>
                      <Loader2 size={18} className="spin" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <Layers size={18} />
                      <span className="btn-consolidar-main">
                        {!diccionarioSeleccionado
                          ? "Selecciona una query"
                          : "Generar consolidado"}
                      </span>
                      <span className="btn-consolidar-sub">
                        ({cantidadSeleccionada} seleccionados)
                      </span>
                    </>
                  )}
                </Button>
              </div>

              {conflictoDiccionariosSeleccionados.hayConflicto && (
                <section className="mix-warning" role="alert" aria-live="assertive" aria-atomic="true">
                  <AlertCircle size={15} />
                  <span>
                    No se puede consolidar: hay múltiples queries en la selección (
                    {conflictoDiccionariosSeleccionados.encontrados.join(", ")}).
                    Deja una sola query en los archivos seleccionados.
                  </span>
                </section>
              )}
              {!conflictoDiccionariosSeleccionados.hayConflicto &&
                incompatibilidadDiccionarioSeleccionado.hayIncompatibilidad && (
                  <section className="mix-warning" role="alert" aria-live="assertive" aria-atomic="true">
                    <AlertCircle size={15} />
                    <span>
                      Los archivos seleccionados no coinciden con la query actual (
                      {diccionarioSeleccionado}). Detectado en nombres:{" "}
                      {incompatibilidadDiccionarioSeleccionado.encontrados.join(", ")}.
                      Elige la query correspondiente o cambia los archivos.
                    </span>
                  </section>
                )}

            </div>

            {/* Right Column: File List */}
            <div className="workflow-right">
               {archivos.length > 0 ? (
                <section className="card file-list-card file-list-card-scroll" id="section-archivos">
                  <div className="card-header file-list-header">
                    <FileSpreadsheet size={16} />
                    <span>Archivos cargados ({archivos.length})</span>
                  </div>
                  <div className="file-list">
                    {archivos.map((f, i) => (
                      <FileBadge
                        key={f.name + i}
                        file={f}
                        seleccionado={archivosSeleccionados.has(f.name)}
                        onToggle={() => toggleArchivo(f.name)}
                        onRemove={() => remover(i)}
                        disabled={uiBloqueada}
                      />
                    ))}
                  </div>
                </section>
              ) : (
                <div className="file-empty-state">
                  No hay archivos cargados
                </div>
              )}
            </div>
          </div>

          {ultimoResultado && estado !== "procesando" && (
            <div className="result-banner">
              <div className="result-banner-header">
                <div className="result-banner-title">
                  <CheckCircle2 size={18} />
                  <span>Consolidado generado exitosamente</span>
                </div>
                <div className="result-file-id">
                  {ultimoResultado.nombre}
                </div>
              </div>

              <div className="result-banner-footer">
                <div className="result-generated-at">
                  Generado el {fmtFecha(ultimoResultado.createdAt)}
                </div>
                <div className="result-footer-actions">
                  <Button
                    className="btn-banner-download"
                    onPress={() => descargarResultado(ultimoResultado)}
                  >
                    <Download size={16} />
                    Descargar {ultimoResultado.formato.toUpperCase()}
                  </Button>
                </div>
              </div>

              <section className="preview-card" aria-label="Previsualización de datos">
                <div className="preview-head">
                  <strong>Previsualización</strong>
                  <span>Primeras 7 filas · todas las columnas</span>
                </div>
                {previewLoading ? (
                  <p className="preview-empty">Cargando previsualización...</p>
                ) : preview?.mensaje ? (
                  <p className="preview-empty">{preview.mensaje}</p>
                ) : preview && preview.headers.length > 0 ? (
                  <div className="preview-table-wrap">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          {preview.headers.map((h) => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r, idx) => (
                          <tr key={`r-${idx}`}>
                            {preview.headers.map((_, cidx) => (
                              <td key={`c-${idx}-${cidx}`}>{r[cidx] ?? ""}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="preview-empty">No hay filas para mostrar.</p>
                )}
              </section>
            </div>
          )}

          {estado === "error" && (
            <section className="result-card err" role="alert" aria-live="assertive" aria-atomic="true">
              <div className="result-header">
                <AlertCircle size={20} className="icon-err" />
                <span>Error al procesar</span>
              </div>
              <p className="err-msg">{error}</p>
              <Button
                className="btn-reset"
                onPress={() => setEstado("idle")}
                aria-label="Intentar nuevamente"
              >
                Intentar de nuevo
              </Button>
            </section>
          )}
        </div>
      </div>

      <ModalOverlay
        isOpen={mostrarDialogoPostDescarga}
        onOpenChange={setMostrarDialogoPostDescarga}
        className="post-download-overlay"
        isDismissable
      >
        <Modal className="post-download-modal">
          <Dialog className="post-download-prompt" aria-label="Confirmar limpieza post descarga">
            <div className="post-download-title">Descarga completada</div>
            <p className="post-download-text">
              ¿Quieres borrar el consolidado y los archivos cargados para subir uno nuevo?
            </p>
            <div className="post-download-actions">
              <Button
                className="btn-cancel"
                onPress={() => setMostrarDialogoPostDescarga(false)}
              >
                Mantener actual
              </Button>
              <Button
                className="btn-banner-download"
                onPress={() => {
                  setMostrarDialogoPostDescarga(false);
                  limpiarTodo();
                }}
              >
                Limpiar y subir nuevo
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>

      <footer className="footer">
        Desarrollado por Martín Beroiza · TIC CESFAM Dr. Alberto Reyes ·{" "}
        {new Date().getFullYear()}
      </footer>
    </main>
  );
}
