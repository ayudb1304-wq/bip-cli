import fs from "node:fs";
import path from "node:path";
import type { EngineEvent, QueueRecord } from "./types.js";

type QueueFiles = {
  pending: string;
  processing: string;
  processed: string;
  dlq: string;
  idempotency: string;
};

function getQueueFiles(cwd = process.cwd()): QueueFiles {
  const base = path.join(cwd, ".bip", "engine");
  return {
    pending: path.join(base, "queue.pending.jsonl"),
    processing: path.join(base, "queue.processing.jsonl"),
    processed: path.join(base, "queue.processed.jsonl"),
    dlq: path.join(base, "queue.dlq.jsonl"),
    idempotency: path.join(base, "idempotency.json"),
  };
}

function toJsonl<T>(entries: T[]): string {
  if (entries.length === 0) return "";
  return `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

function writeJsonl<T>(filePath: string, entries: T[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, toJsonl(entries), "utf-8");
}

function readIdempotencySet(filePath: string): Set<string> {
  if (!fs.existsSync(filePath)) return new Set<string>();
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as { keys?: string[] };
  return new Set(parsed.keys ?? []);
}

function writeIdempotencySet(filePath: string, keys: Set<string>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ keys: Array.from(keys.values()) }, null, 2), "utf-8");
}

function toQueueRecord(event: EngineEvent): QueueRecord {
  const now = new Date().toISOString();
  return {
    event,
    status: "pending",
    attempts: Math.max(event.retryCount ?? 0, 0),
    enqueuedAt: now,
    updatedAt: now,
    availableAt: now,
  };
}

export function enqueueEvents(events: EngineEvent[], cwd = process.cwd()): void {
  if (events.length === 0) return;

  const files = getQueueFiles(cwd);
  const idempotency = readIdempotencySet(files.idempotency);
  const pending = readJsonl<QueueRecord>(files.pending);
  const now = new Date().toISOString();

  for (const event of events) {
    const key = event.idempotencyKey || event.id;
    if (idempotency.has(key)) continue;
    idempotency.add(key);
    pending.push({
      ...toQueueRecord(event),
      enqueuedAt: now,
      updatedAt: now,
      availableAt: now,
    });
  }

  writeJsonl(files.pending, pending);
  writeIdempotencySet(files.idempotency, idempotency);
}

export function readQueue(cwd = process.cwd()): EngineEvent[] {
  const files = getQueueFiles(cwd);
  const now = new Date().toISOString();
  return readJsonl<QueueRecord>(files.pending)
    .filter((record) => record.availableAt <= now)
    .map((record) => record.event);
}

export function dequeueEvent(cwd = process.cwd()): EngineEvent | null {
  const record = claimNextEvent(cwd);
  return record?.event ?? null;
}

export function claimNextEvent(cwd = process.cwd()): QueueRecord | null {
  const files = getQueueFiles(cwd);
  const pending = readJsonl<QueueRecord>(files.pending);
  if (pending.length === 0) return null;

  const nowIso = new Date().toISOString();
  const readyIndex = pending.findIndex((record) => record.availableAt <= nowIso);
  if (readyIndex === -1) return null;

  const [record] = pending.splice(readyIndex, 1);
  const processing = readJsonl<QueueRecord>(files.processing);
  const updated: QueueRecord = {
    ...record,
    status: "processing",
    updatedAt: nowIso,
  };
  processing.push(updated);
  writeJsonl(files.pending, pending);
  writeJsonl(files.processing, processing);
  return updated;
}

export function ackEvent(record: QueueRecord, cwd = process.cwd()): void {
  const files = getQueueFiles(cwd);
  const processing = readJsonl<QueueRecord>(files.processing);
  const remaining = processing.filter((entry) => entry.event.id !== record.event.id);
  writeJsonl(files.processing, remaining);

  const processed = readJsonl<QueueRecord>(files.processed);
  processed.push({
    ...record,
    status: "processed",
    updatedAt: new Date().toISOString(),
  });
  writeJsonl(files.processed, processed);
}

export function nackEvent(
  record: QueueRecord,
  error: unknown,
  cwd = process.cwd(),
  retryDelayMs = 30_000
): void {
  const files = getQueueFiles(cwd);
  const processing = readJsonl<QueueRecord>(files.processing);
  const remaining = processing.filter((entry) => entry.event.id !== record.event.id);
  writeJsonl(files.processing, remaining);

  const attempts = record.attempts + 1;
  const maxRetries = record.event.maxRetries ?? 3;
  const err = error instanceof Error ? error.message : String(error);
  const now = Date.now();
  const next: QueueRecord = {
    ...record,
    attempts,
    lastError: err,
    event: {
      ...record.event,
      retryCount: attempts,
      lastError: err,
    },
    updatedAt: new Date(now).toISOString(),
    availableAt: new Date(now + retryDelayMs * attempts).toISOString(),
  };

  if (attempts > maxRetries) {
    const dlq = readJsonl<QueueRecord>(files.dlq);
    dlq.push({
      ...next,
      status: "failed",
    });
    writeJsonl(files.dlq, dlq);
    return;
  }

  const pending = readJsonl<QueueRecord>(files.pending);
  pending.push({
    ...next,
    status: "pending",
  });
  writeJsonl(files.pending, pending);
}

export function queueStats(cwd = process.cwd()): {
  pending: number;
  processing: number;
  processed: number;
  dlq: number;
} {
  const files = getQueueFiles(cwd);
  return {
    pending: readJsonl<QueueRecord>(files.pending).length,
    processing: readJsonl<QueueRecord>(files.processing).length,
    processed: readJsonl<QueueRecord>(files.processed).length,
    dlq: readJsonl<QueueRecord>(files.dlq).length,
  };
}

export function readQueueRecords(
  state: "pending" | "processing" | "processed" | "dlq",
  cwd = process.cwd()
): QueueRecord[] {
  const files = getQueueFiles(cwd);
  const target =
    state === "pending"
      ? files.pending
      : state === "processing"
        ? files.processing
        : state === "processed"
          ? files.processed
          : files.dlq;
  return readJsonl<QueueRecord>(target);
}
