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
import { renderDrafts } from "../lib/templates.js";

export const generateCommand = new Command("generate")
  .description("Generate platform-specific social media drafts from a commit")
  .requiredOption("--commit <sha>", "Git commit SHA to analyze")
  .option("--save", "Save drafts to .bip/drafts/")
  .action(async (opts: { commit: string; save?: boolean }) => {
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
      const drafts = renderDrafts(narrative, diff, config);

      for (const draft of drafts) {
        const label = draft.platform === "x" ? "X (Twitter)" : "LinkedIn";
        console.log(chalk.magenta.bold(`── ${label} ──`));

        if (draft.threadParts && draft.threadParts.length > 1) {
          draft.threadParts.forEach((part, i) => {
            console.log(chalk.dim(`[${i + 1}/${draft.threadParts!.length}]`));
            console.log(part);
            console.log();
          });
        } else {
          console.log(draft.content);
        }

        console.log();
      }

      saveNarrativeMemoryEntry(diff, narrative);
      logGenerationTelemetry("generate", diff.commitSha, telemetry);

      if (opts.save) {
        const draftsDir = path.resolve(process.cwd(), ".bip", "drafts");
        fs.mkdirSync(draftsDir, { recursive: true });

        const narrativesDir = path.resolve(process.cwd(), ".bip", "narratives");
        fs.mkdirSync(narrativesDir, { recursive: true });

        const shortSha = diff.commitSha.slice(0, 8);

        fs.writeFileSync(
          path.join(narrativesDir, `${shortSha}.json`),
          JSON.stringify(narrative, null, 2),
          "utf-8"
        );

        for (const draft of drafts) {
          const filename = `${shortSha}-${draft.platform}.md`;
          const outPath = path.join(draftsDir, filename);
          fs.writeFileSync(outPath, draft.content, "utf-8");
          console.log(chalk.dim(`Saved: ${outPath}`));
        }
      }

      console.log(
        chalk.dim(
          `Estimated LLM cost: $${telemetry.estimatedCostUsd.toFixed(6)} (${telemetry.inputTokensEstimate} in / ${telemetry.outputTokensEstimate} out tokens est.)`
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("GEMINI_API_KEY") || message.includes(".bip/config.yml")) {
        console.log(
          chalk.cyan(
            "Tip: run `npx @ayudb1304/sushi quickstart` first for guided setup and an instant demo."
          )
        );
      }
      reportCommandError("generate", error);
      throw error;
    }
  });
