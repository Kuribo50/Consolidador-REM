export const QUEUE_NAME = "consolidar-jobs";

export const MAX_XLSX_RUNNING = Number(process.env.CONSOLIDAR_MAX_XLSX ?? 4);
export const MAX_CSV_RUNNING = Number(process.env.CONSOLIDAR_MAX_CSV ?? 8);
export const MAX_TOTAL_RUNNING = Number(process.env.CONSOLIDAR_MAX_TOTAL ?? 8);

export const JOB_WAIT_TIMEOUT_MS = Number(
  process.env.CONSOLIDAR_JOB_WAIT_TIMEOUT_MS ?? 15 * 60 * 1000,
);

export const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
