import fs from "node:fs";
import path from "node:path";
import type { EngineEvent } from "./types.js";

function getQueuePath(cwd = process.cwd()): string {
  return path.join(cwd, ".bip", "engine", "queue.jsonl");
}

export function enqueueEvents(events: EngineEvent[], cwd = process.cwd()): void {
  if (events.length === 0) return;

  const queuePath = getQueuePath(cwd);
  fs.mkdirSync(path.dirname(queuePath), { recursive: true });
  const lines = events.map((event) => JSON.stringify(event)).join("\n") + "\n";
  fs.appendFileSync(queuePath, lines, "utf-8");
}

export function readQueue(cwd = process.cwd()): EngineEvent[] {
  const queuePath = getQueuePath(cwd);
  if (!fs.existsSync(queuePath)) return [];

  const raw = fs.readFileSync(queuePath, "utf-8");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as EngineEvent);
}

export function dequeueEvent(cwd = process.cwd()): EngineEvent | null {
  const queuePath = getQueuePath(cwd);
  const events = readQueue(cwd);
  if (events.length === 0) return null;

  const [next, ...rest] = events;
  fs.mkdirSync(path.dirname(queuePath), { recursive: true });
  const content = rest.map((event) => JSON.stringify(event)).join("\n");
  fs.writeFileSync(queuePath, content.length > 0 ? `${content}\n` : "", "utf-8");
  return next;
}
