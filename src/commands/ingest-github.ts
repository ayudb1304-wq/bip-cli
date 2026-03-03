import { Command } from "commander";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { buildPushCommitEvents, parseGitHubPushPayload } from "../lib/phase2/github.js";
import { enqueueEvents } from "../lib/phase2/queue.js";
import { upsertInstallationToken } from "../lib/phase2/token-store.js";
import { reportCommandError } from "../lib/monitoring.js";

export const ingestGithubCommand = new Command("ingest-github")
  .description("Ingest a GitHub push webhook payload into the local engine queue")
  .requiredOption("--event-file <path>", "Path to GitHub push webhook JSON payload")
  .option("--repo-path <path>", "Local repository path to process commits against")
  .option("--delivery-id <id>", "GitHub delivery ID for idempotency tracing")
  .option("--github-token <token>", "GitHub token for diff retrieval in worker")
  .option("--installation-id <id>", "GitHub installation ID", (value) => Number(value))
  .action(
    async (opts: {
      eventFile: string;
      repoPath?: string;
      deliveryId?: string;
      githubToken?: string;
      installationId?: number;
    }) => {
    try {
      const payloadPath = path.resolve(process.cwd(), opts.eventFile);
      const raw = fs.readFileSync(payloadPath, "utf-8");
      const payload = parseGitHubPushPayload(JSON.parse(raw));
      const events = buildPushCommitEvents(payload, {
        repoPath: opts.repoPath,
        deliveryId: opts.deliveryId,
      });

      const token = opts.githubToken || process.env.GITHUB_INSTALLATION_TOKEN;
      if (token) {
        upsertInstallationToken(payload.repository.full_name, token, {
          installationId: opts.installationId ?? payload.installation?.id,
        });
      }

      enqueueEvents(events);
      console.log(chalk.green(`Enqueued ${events.length} GitHub commit event(s).`));
    } catch (error) {
      reportCommandError("ingest-github", error);
      throw error;
    }
    }
  );
