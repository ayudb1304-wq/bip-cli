import { Command } from "commander";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../lib/config.js";
import { parseDiff } from "../lib/git-parser.js";
import { generateNarrativeWithTelemetry } from "../lib/llm.js";
import {
  buildMemoryContext,
  loadNarrativeMemory,
  saveNarrativeMemoryEntry,
} from "../lib/memory.js";
import { logGenerationTelemetry, reportCommandError } from "../lib/monitoring.js";

export const summarizeCommand = new Command("summarize")
  .description("Analyze a commit and generate a problem/solution narrative")
  .requiredOption("--commit <sha>", "Git commit SHA to analyze")
  .action(async (opts: { commit: string }) => {
    try {
      const config = loadConfig();
      const diff = await parseDiff(opts.commit);
      const memory = loadNarrativeMemory();
      const memoryContext = buildMemoryContext(diff, memory);

      console.log(chalk.cyan("Analyzing commit ") + chalk.bold(diff.commitSha.slice(0, 8)) + "...\n");

      const { narrative, telemetry } = await generateNarrativeWithTelemetry(
        diff,
        config,
        memoryContext
      );

      console.log(chalk.green.bold("Problem"));
      console.log(narrative.problem + "\n");

      console.log(chalk.green.bold("Solution"));
      console.log(narrative.solution + "\n");

      console.log(chalk.green.bold("Risk"));
      console.log(narrative.risk + "\n");

      console.log(chalk.green.bold("Testing Notes"));
      console.log(narrative.testingNotes + "\n");

      const bipDir = path.resolve(process.cwd(), ".bip", "narratives");
      fs.mkdirSync(bipDir, { recursive: true });

      const outPath = path.join(bipDir, `${diff.commitSha.slice(0, 8)}.json`);
      fs.writeFileSync(outPath, JSON.stringify(narrative, null, 2), "utf-8");
      saveNarrativeMemoryEntry(diff, narrative);
      logGenerationTelemetry("summarize", diff.commitSha, telemetry);

      console.log(chalk.dim(`Narrative saved to ${outPath}`));
      console.log(
        chalk.dim(
          `Estimated LLM cost: $${telemetry.estimatedCostUsd.toFixed(6)} (${telemetry.inputTokensEstimate} in / ${telemetry.outputTokensEstimate} out tokens est.)`
        )
      );
    } catch (error) {
      reportCommandError("summarize", error);
      throw error;
    }
  });
