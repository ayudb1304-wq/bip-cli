import { Command } from "commander";
import chalk from "chalk";
import { reportCommandError } from "../lib/monitoring.js";
import { startDashboardServer } from "../lib/phase2/dashboard-server.js";

export const serveDashboardCommand = new Command("serve-dashboard")
  .description("Run dashboard API server and React timeline UI")
  .option("--port <number>", "Port for dashboard server", "8788")
  .option("--host <host>", "Host binding", "0.0.0.0")
  .action((opts: { port: string; host: string }) => {
    try {
      const port = Number(opts.port);
      const server = startDashboardServer({ port, host: opts.host });
      console.log(chalk.green(`Dashboard server: http://${opts.host}:${port}`));
      process.on("SIGINT", () => {
        server.close();
        process.exit(0);
      });
    } catch (error) {
      reportCommandError("serve-dashboard", error);
      throw error;
    }
  });
