import { Command } from "commander";
import chalk from "chalk";
import { ackEvent, claimNextEvent, nackEvent, queueStats } from "../lib/phase2/queue.js";
import { processEngineEvent } from "../lib/phase2/worker.js";
import { reportCommandError } from "../lib/monitoring.js";

export const runWorkerCommand = new Command("run-worker")
  .description("Process queued engine events and generate drafts")
  .option("--once", "Process only one event from the queue")
  .action(async (opts: { once?: boolean }) => {
    try {
      const before = queueStats();
      if (before.pending === 0) {
        console.log(chalk.yellow("Queue is empty. Nothing to process."));
        return;
      }

      const maxIterations = opts.once ? 1 : before.pending;
      let processed = 0;

      for (let i = 0; i < maxIterations; i++) {
        const record = claimNextEvent();
        if (!record) break;
        try {
          const result = await processEngineEvent(record.event);
          ackEvent(record);
          processed += 1;
          console.log(
            chalk.green(
              `Processed ${result.commitSha.slice(0, 8)} -> ${result.outputPath}`
            )
          );
        } catch (error) {
          nackEvent(record, error);
          console.log(
            chalk.red(
              `Failed ${record.event.commitSha.slice(0, 8)}; requeued or moved to DLQ.`
            )
          );
        }
      }

      const after = queueStats();
      console.log(
        chalk.cyan(
          `Worker finished. Processed ${processed} event(s). pending=${after.pending} processing=${after.processing} dlq=${after.dlq}`
        )
      );
    } catch (error) {
      reportCommandError("run-worker", error);
      throw error;
    }
  });
