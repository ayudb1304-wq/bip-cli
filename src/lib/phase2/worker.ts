import fs from "node:fs";
import path from "node:path";
import { parseDiff } from "../git-parser.js";
import { loadConfig } from "../config.js";
import { generateNarrativeWithTelemetry } from "../llm.js";
import { renderDrafts } from "../templates.js";
import { buildMemoryContext, loadNarrativeMemory, saveNarrativeMemoryEntry } from "../memory.js";
import { logGenerationTelemetry } from "../monitoring.js";
import type { EngineEvent, WorkerResult } from "./types.js";

export async function processEngineEvent(event: EngineEvent): Promise<WorkerResult> {
  const repoPath = event.repoPath ?? process.cwd();
  const config = loadConfig(repoPath);
  const diff = await parseDiff(event.commitSha, repoPath);
  const memory = loadNarrativeMemory(repoPath);
  const memoryContext = buildMemoryContext(diff, memory);
  const { narrative, telemetry } = await generateNarrativeWithTelemetry(
    diff,
    config,
    memoryContext
  );
  const drafts = renderDrafts(narrative, diff, config);

  saveNarrativeMemoryEntry(diff, narrative, repoPath);
  logGenerationTelemetry("engine-worker", diff.commitSha, telemetry, repoPath);

  const outDir = path.join(repoPath, ".bip", "engine", "outputs");
  fs.mkdirSync(outDir, { recursive: true });

  const outputPath = path.join(outDir, `${event.commitSha.slice(0, 8)}.json`);
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        event,
        narrative,
        drafts,
        telemetry,
      },
      null,
      2
    ),
    "utf-8"
  );

  return {
    eventId: event.id,
    commitSha: event.commitSha,
    outputPath,
  };
}
