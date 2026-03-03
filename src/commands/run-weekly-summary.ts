import { Command } from "commander";
import chalk from "chalk";
import { reportCommandError } from "../lib/monitoring.js";
import { writeWeeklySummary } from "../lib/phase2/exports.js";

export const runWeeklySummaryCommand = new Command("run-weekly-summary")
  .description("Generate weekly summary markdown on interval or once")
  .option("--once", "Generate summary once and exit")
  .option("--interval-hours <hours>", "Interval for recurring summary generation", "168")
  .action((opts: { once?: boolean; intervalHours: string }) => {
    const run = () => {
      const outputPath = writeWeeklySummary();
      console.log(chalk.green(`Weekly summary generated: ${outputPath}`));
    };

    try {
      run();
      if (opts.once) return;

      const intervalMs = Number(opts.intervalHours) * 60 * 60 * 1000;
      setInterval(run, intervalMs);
      console.log(chalk.cyan(`Weekly summary cron running every ${opts.intervalHours}h`));
    } catch (error) {
      reportCommandError("run-weekly-summary", error);
      throw error;
    }
  });
