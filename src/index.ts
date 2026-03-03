#!/usr/bin/env node

import "dotenv/config";
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { summarizeCommand } from "./commands/summarize.js";
import { generateCommand } from "./commands/generate.js";

const program = new Command();

program
  .name("bip")
  .version("0.1.0")
  .description(
    "Build-in-Public Content Engine — transform Git diffs into platform-specific social media drafts"
  );

program.addCommand(initCommand);
program.addCommand(summarizeCommand);
program.addCommand(generateCommand);

program.parse();
