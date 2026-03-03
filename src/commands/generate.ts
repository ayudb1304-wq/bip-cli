import { Command } from "commander";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../lib/config.js";
import { parseDiff } from "../lib/git-parser.js";
import { generateNarrative } from "../lib/llm.js";
import { renderDrafts } from "../lib/templates.js";

export const generateCommand = new Command("generate")
  .description("Generate platform-specific social media drafts from a commit")
  .requiredOption("--commit <sha>", "Git commit SHA to analyze")
  .option("--save", "Save drafts to .bip/drafts/")
  .action(async (opts: { commit: string; save?: boolean }) => {
    const config = loadConfig();
    const diff = await parseDiff(opts.commit);

    console.log(chalk.cyan("Analyzing commit ") + chalk.bold(diff.commitSha.slice(0, 8)) + "...\n");

    const narrative = await generateNarrative(diff, config);
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
  });
