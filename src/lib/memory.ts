import fs from "node:fs";
import path from "node:path";
import type { DiffResult } from "./git-parser.js";
import type { Narrative } from "./llm.js";

export interface NarrativeMemoryEntry {
  commitSha: string;
  message: string;
  date: string;
  files: string[];
  problem: string;
  solution: string;
  savedAt: string;
}

interface NarrativeMemoryState {
  version: 1;
  entries: NarrativeMemoryEntry[];
}

const MEMORY_VERSION = 1;
const MAX_MEMORY_ENTRIES = 25;

export function getNarrativeMemoryPath(cwd = process.cwd()): string {
  return path.join(cwd, ".bip", "memory.json");
}

export function loadNarrativeMemory(cwd = process.cwd()): NarrativeMemoryEntry[] {
  const memoryPath = getNarrativeMemoryPath(cwd);
  if (!fs.existsSync(memoryPath)) return [];

  try {
    const raw = fs.readFileSync(memoryPath, "utf-8");
    const parsed = JSON.parse(raw) as NarrativeMemoryState;
    if (!parsed || parsed.version !== MEMORY_VERSION || !Array.isArray(parsed.entries)) {
      return [];
    }
    return parsed.entries;
  } catch {
    return [];
  }
}

export function saveNarrativeMemoryEntry(
  diff: DiffResult,
  narrative: Narrative,
  cwd = process.cwd()
): NarrativeMemoryEntry[] {
  const current = loadNarrativeMemory(cwd);
  const nextEntry: NarrativeMemoryEntry = {
    commitSha: diff.commitSha,
    message: diff.message,
    date: diff.date,
    files: diff.files.map((file) => file.filename),
    problem: narrative.problem,
    solution: narrative.solution,
    savedAt: new Date().toISOString(),
  };

  const deduped = current.filter((entry) => entry.commitSha !== diff.commitSha);
  const next = [nextEntry, ...deduped].slice(0, MAX_MEMORY_ENTRIES);
  const memoryPath = getNarrativeMemoryPath(cwd);

  fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
  const payload: NarrativeMemoryState = { version: MEMORY_VERSION, entries: next };
  fs.writeFileSync(memoryPath, JSON.stringify(payload, null, 2), "utf-8");
  return next;
}

export function buildMemoryContext(
  diff: DiffResult,
  entries: NarrativeMemoryEntry[],
  maxEntries = 3
): string {
  if (entries.length === 0) return "";

  const currentFiles = new Set(diff.files.map((f) => f.filename));
  const scored = entries
    .filter((entry) => entry.commitSha !== diff.commitSha)
    .map((entry) => {
      const overlapCount = entry.files.filter((file) => currentFiles.has(file)).length;
      return { entry, overlapCount };
    })
    .sort((a, b) => {
      if (b.overlapCount !== a.overlapCount) return b.overlapCount - a.overlapCount;
      return b.entry.savedAt.localeCompare(a.entry.savedAt);
    });

  const selected = scored
    .filter((item) => item.overlapCount > 0)
    .slice(0, maxEntries)
    .map((item) => item.entry);

  const fallback = selected.length > 0 ? selected : entries.slice(0, maxEntries);

  if (fallback.length === 0) return "";

  return fallback
    .map((entry) => {
      const shortSha = entry.commitSha.slice(0, 8);
      return `- [${shortSha}] ${entry.message}\n  Problem: ${entry.problem}\n  Solution: ${entry.solution}`;
    })
    .join("\n");
}
