#!/usr/bin/env node

import "dotenv/config";
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { summarizeCommand } from "./commands/summarize.js";
import { generateCommand } from "./commands/generate.js";
import { ingestGithubCommand } from "./commands/ingest-github.js";
import { runWorkerCommand } from "./commands/run-worker.js";

const program = new Command();

program
  .name("sushi")
  .version("0.1.1")
  .description(
    "Build-in-Public Content Engine — transform Git diffs into platform-specific social media drafts"
  );

program.addCommand(initCommand);
program.addCommand(summarizeCommand);
program.addCommand(generateCommand);
program.addCommand(ingestGithubCommand);
program.addCommand(runWorkerCommand);

program.parse();
