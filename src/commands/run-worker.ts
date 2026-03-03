import { Command } from "commander";
import chalk from "chalk";
import { dequeueEvent, readQueue } from "../lib/phase2/queue.js";
import { processEngineEvent } from "../lib/phase2/worker.js";
import { reportCommandError } from "../lib/monitoring.js";

export const runWorkerCommand = new Command("run-worker")
  .description("Process queued engine events and generate drafts")
  .option("--once", "Process only one event from the queue")
  .action(async (opts: { once?: boolean }) => {
    try {
      const queueSize = readQueue().length;
      if (queueSize === 0) {
        console.log(chalk.yellow("Queue is empty. Nothing to process."));
        return;
      }

      const maxIterations = opts.once ? 1 : queueSize;
      let processed = 0;

      for (let i = 0; i < maxIterations; i++) {
        const event = dequeueEvent();
        if (!event) break;
        const result = await processEngineEvent(event);
        processed += 1;
        console.log(
          chalk.green(
            `Processed ${result.commitSha.slice(0, 8)} -> ${result.outputPath}`
          )
        );
      }

      console.log(chalk.cyan(`Worker finished. Processed ${processed} event(s).`));
    } catch (error) {
      reportCommandError("run-worker", error);
      throw error;
    }
  });
