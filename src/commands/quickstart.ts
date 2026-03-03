import { Command } from "commander";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { parseDiff } from "../lib/git-parser.js";
import { buildDemoNarrative, buildSyntheticDiff, ensureConfig } from "../lib/onboarding.js";
import { buildMemoryContext, loadNarrativeMemory, saveNarrativeMemoryEntry } from "../lib/memory.js";
import { generateNarrativeWithTelemetry } from "../lib/llm.js";
import { renderDrafts } from "../lib/templates.js";
import { logGenerationTelemetry, reportCommandError } from "../lib/monitoring.js";

interface QuickstartOptions {
  commit: string;
  save?: boolean;
}

function writeDrafts(commitSha: string, drafts: Array<{ platform: string; content: string }>, narrative: unknown) {
  const draftsDir = path.resolve(process.cwd(), ".bip", "drafts");
  const narrativesDir = path.resolve(process.cwd(), ".bip", "narratives");
  fs.mkdirSync(draftsDir, { recursive: true });
  fs.mkdirSync(narrativesDir, { recursive: true });

  const shortSha = commitSha.slice(0, 8);
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

export const quickstartCommand = new Command("quickstart")
  .alias("onboard")
  .alias("start")
  .description("First-run onboarding: instant demo drafts, then guided real mode")
  .option("--commit <sha>", "Commit SHA to use (default: latest commit)", "HEAD")
  .option("--no-save", "Do not save generated drafts to .bip/drafts/")
  .action(async (opts: QuickstartOptions) => {
    try {
      const apiKeyPresent = Boolean(process.env.GEMINI_API_KEY);
      const { config, configPath, created } = ensureConfig(process.cwd());

      if (created) {
        console.log(chalk.green("Created default config: ") + chalk.bold(configPath));
      } else {
        console.log(chalk.dim(`Using config: ${configPath}`));
      }

      let diff;
      try {
        diff = await parseDiff(opts.commit);
      } catch {
        diff = buildSyntheticDiff(process.cwd());
        console.log(
          chalk.yellow(
            "No Git commit found here, so quickstart is using a local demo snapshot."
          )
        );
      }

      const memory = loadNarrativeMemory();
      const memoryContext = buildMemoryContext(diff, memory);

      if (!apiKeyPresent) {
        console.log(chalk.cyan("Running demo mode (no API key)...\n"));
        const narrative = buildDemoNarrative(diff);
        const drafts = renderDrafts(narrative, diff, config);

        console.log(chalk.magenta.bold("Demo draft (no API key)"));
        console.log(chalk.dim("This is a local preview so you can get started instantly.\n"));

        for (const draft of drafts) {
          const label = draft.platform === "x" ? "X (Twitter)" : "LinkedIn";
          console.log(chalk.magenta.bold(`── ${label} ──`));
          console.log(draft.content);
          console.log();
        }

        if (opts.save !== false) {
          writeDrafts(diff.commitSha, drafts, narrative);
        }
        saveNarrativeMemoryEntry(diff, narrative);

        console.log(chalk.green("Success in under 30s: you generated your first draft."));
        console.log(
          chalk.bold("Next step for real AI drafts: ") +
            "add `GEMINI_API_KEY=<your-key>` to a `.env` file, then run `npx @ayudb1304/sushi quickstart` again."
        );
        return;
      }

      console.log(chalk.cyan("Running real mode with Gemini...\n"));
      const { narrative, telemetry } = await generateNarrativeWithTelemetry(
        diff,
        config,
        memoryContext
      );
      const drafts = renderDrafts(narrative, diff, config);

      for (const draft of drafts) {
        const label = draft.platform === "x" ? "X (Twitter)" : "LinkedIn";
        console.log(chalk.magenta.bold(`── ${label} ──`));
        console.log(draft.content);
        console.log();
      }

      if (opts.save !== false) {
        writeDrafts(diff.commitSha, drafts, narrative);
      }
      saveNarrativeMemoryEntry(diff, narrative);
      logGenerationTelemetry("quickstart", diff.commitSha, telemetry);
      console.log(
        chalk.dim(
          `Estimated LLM cost: $${telemetry.estimatedCostUsd.toFixed(6)} (${telemetry.inputTokensEstimate} in / ${telemetry.outputTokensEstimate} out tokens est.)`
        )
      );
    } catch (error) {
      reportCommandError("quickstart", error);
      throw error;
    }
  });
