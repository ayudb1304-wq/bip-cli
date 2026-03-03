import { Command } from "commander";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { buildPushCommitEvents, parseGitHubPushPayload } from "../lib/phase2/github.js";
import { enqueueEvents } from "../lib/phase2/queue.js";
import { reportCommandError } from "../lib/monitoring.js";

export const ingestGithubCommand = new Command("ingest-github")
  .description("Ingest a GitHub push webhook payload into the local engine queue")
  .requiredOption("--event-file <path>", "Path to GitHub push webhook JSON payload")
  .option("--repo-path <path>", "Local repository path to process commits against")
  .action(async (opts: { eventFile: string; repoPath?: string }) => {
    try {
      const payloadPath = path.resolve(process.cwd(), opts.eventFile);
      const raw = fs.readFileSync(payloadPath, "utf-8");
      const payload = parseGitHubPushPayload(JSON.parse(raw));
      const events = buildPushCommitEvents(payload, { repoPath: opts.repoPath });

      enqueueEvents(events);
      console.log(chalk.green(`Enqueued ${events.length} GitHub commit event(s).`));
    } catch (error) {
      reportCommandError("ingest-github", error);
      throw error;
    }
  });
