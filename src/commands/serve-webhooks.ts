import { Command } from "commander";
import chalk from "chalk";
import { reportCommandError } from "../lib/monitoring.js";
import { startWebhookServer } from "../lib/phase2/webhook-server.js";

export const serveWebhooksCommand = new Command("serve-webhooks")
  .description("Run a GitHub webhook receiver with signature verification")
  .option("--port <number>", "Port for webhook server", "8787")
  .option("--host <host>", "Host binding", "0.0.0.0")
  .action((opts: { port: string; host: string }) => {
    try {
      const port = Number(opts.port);
      const server = startWebhookServer({ port, host: opts.host });
      console.log(
        chalk.green(
          `Webhook server listening on http://${opts.host}:${port}/webhooks/github`
        )
      );
      console.log(chalk.cyan("Health endpoint: /healthz"));
      process.on("SIGINT", () => {
        server.close();
        process.exit(0);
      });
    } catch (error) {
      reportCommandError("serve-webhooks", error);
      throw error;
    }
  });
