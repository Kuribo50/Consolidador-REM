import { spawn } from "child_process";
import { Queue, QueueEvents, Worker } from "bullmq";
import { QUEUE_NAME, MAX_CSV_RUNNING, MAX_TOTAL_RUNNING, MAX_XLSX_RUNNING } from "./config";
import { getRedis } from "./redis";

type ProcessResult = {
  stdout: string;
  stderr: string;
};

type ProcessError = Error & {
  stdout?: string;
  stderr?: string;
  code?: number | string;
};

export type ConsolidarJobData = {
  scriptPath: string;
  inputDir: string;
  outputPath: string;
  formato: "csv" | "xlsx";
  tipo: string;
  separador?: string;
  diccionarioTipo?: string;
  diccionarioNombre?: string;
};

export type ConsolidarJobResult = {
  ok: boolean;
  stderr: string;
  outputPath: string;
};

const PYTHON_CANDIDATES =
  process.platform === "win32"
    ? [
        { command: "py", args: ["-3"] },
        { command: "python", args: [] },
        { command: "python3", args: [] },
      ]
    : [
        { command: "python3", args: [] },
        { command: "python", args: [] },
      ];

function isCommandNotFound(error: ProcessError): boolean {
  const combined = `${error.message ?? ""}\n${error.stderr ?? ""}`;
  return /(not recognized|command not found|no se reconoce|enoent)/i.test(combined);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function runProcess(command: string, args: string[], timeoutMs: number): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const resolveOnce = (result: ProcessResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const rejectOnce = (error: ProcessError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      const error = new Error(err.message) as ProcessError;
      error.code = err.code ?? "ENOENT";
      error.stdout = stdout;
      error.stderr = stderr;
      rejectOnce(error);
    });

    child.on("close", (code, signal) => {
      if (timedOut) {
        const error = new Error("timeout") as ProcessError;
        error.code = 1;
        error.stdout = stdout;
        error.stderr = `${stderr}\ntimeout`;
        rejectOnce(error);
        return;
      }
      if (signal) {
        const error = new Error(`Process terminated by signal ${signal}`) as ProcessError;
        error.code = signal;
        error.stdout = stdout;
        error.stderr = stderr;
        rejectOnce(error);
        return;
      }
      if (code === 0) {
        resolveOnce({ stdout, stderr });
        return;
      }
      const error = new Error(`Process exited with code ${code}`) as ProcessError;
      error.code = code ?? 1;
      error.stdout = stdout;
      error.stderr = stderr;
      rejectOnce(error);
    });
  });
}

export async function runConsolidarScript(options: ConsolidarJobData): Promise<ProcessResult> {
  const baseArgs = [
    options.scriptPath,
    "--input",
    options.inputDir,
    "--output",
    options.outputPath,
    "--formato",
    options.formato,
    "--tipo",
    options.tipo,
    "--separador",
    options.separador || "auto",
  ];
  if (options.diccionarioTipo && options.diccionarioNombre) {
    baseArgs.push(
      "--diccionario-tipo",
      options.diccionarioTipo,
      "--diccionario",
      options.diccionarioNombre,
    );
  }

  let lastError: ProcessError | undefined;
  for (const candidate of PYTHON_CANDIDATES) {
    try {
      return await runProcess(candidate.command, [...candidate.args, ...baseArgs], 300_000);
    } catch (err) {
      const error = err as ProcessError;
      lastError = error;
      if (isCommandNotFound(error)) continue;
      throw error;
    }
  }
  const error = new Error(
    "No se encontró Python. Instale Python y habilite 'py' o 'python' en PATH.",
  ) as ProcessError;
  error.code = lastError?.code;
  error.stderr = lastError?.stderr;
  throw error;
}

const SLOT_TOTAL = "consolidar:slots:total";
const SLOT_CSV = "consolidar:slots:csv";
const SLOT_XLSX = "consolidar:slots:xlsx";

async function acquireSlot(formato: "csv" | "xlsx") {
  const redis = getRedis();
  while (true) {
    await redis.watch(SLOT_TOTAL, SLOT_CSV, SLOT_XLSX);
    const [totS, csvS, xlsxS] = await redis.mget(SLOT_TOTAL, SLOT_CSV, SLOT_XLSX);
    const total = Number(totS ?? 0);
    const csv = Number(csvS ?? 0);
    const xlsx = Number(xlsxS ?? 0);
    const canRun =
      total < MAX_TOTAL_RUNNING &&
      (formato === "xlsx" ? xlsx < MAX_XLSX_RUNNING : csv < MAX_CSV_RUNNING);
    if (!canRun) {
      await redis.unwatch();
      await sleep(300);
      continue;
    }
    const multi = redis.multi();
    multi.incr(SLOT_TOTAL);
    if (formato === "xlsx") multi.incr(SLOT_XLSX);
    else multi.incr(SLOT_CSV);
    const res = await multi.exec();
    if (res) return;
    await sleep(100);
  }
}

async function releaseSlot(formato: "csv" | "xlsx") {
  const redis = getRedis();
  const multi = redis.multi();
  multi.decr(SLOT_TOTAL);
  if (formato === "xlsx") multi.decr(SLOT_XLSX);
  else multi.decr(SLOT_CSV);
  await multi.exec();
}

type QueueContext = {
  queue: Queue<ConsolidarJobData, ConsolidarJobResult>;
  events: QueueEvents;
};

declare global {
  // eslint-disable-next-line no-var
  var __consolidadorQueueCtx__: QueueContext | undefined;
  // eslint-disable-next-line no-var
  var __consolidadorWorkerStarted__: boolean | undefined;
}

export async function getQueueContext(): Promise<QueueContext> {
  if (global.__consolidadorQueueCtx__) return global.__consolidadorQueueCtx__;

  const redis = getRedis();
  await redis.ping();

  const queue = new Queue<ConsolidarJobData, ConsolidarJobResult>(QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 1,
    },
  });
  const events = new QueueEvents(QUEUE_NAME, { connection: redis });

  if (!global.__consolidadorWorkerStarted__) {
    const worker = new Worker<ConsolidarJobData, ConsolidarJobResult>(
      QUEUE_NAME,
      async (job) => {
        await acquireSlot(job.data.formato);
        try {
          const { stderr } = await runConsolidarScript(job.data);
          return { ok: true, stderr, outputPath: job.data.outputPath };
        } finally {
          await releaseSlot(job.data.formato);
        }
      },
      { connection: redis, concurrency: MAX_TOTAL_RUNNING },
    );
    worker.on("failed", (job, err) => {
      console.error("[Queue] Job failed", job?.id, err?.message);
    });
    worker.on("error", (err) => {
      console.error("[Queue] Worker error", err?.message);
    });
    global.__consolidadorWorkerStarted__ = true;
  }

  global.__consolidadorQueueCtx__ = { queue, events };
  return global.__consolidadorQueueCtx__;
}
