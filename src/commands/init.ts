import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import yaml from "js-yaml";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import type { BipConfig } from "../lib/config.js";

function printSushiBanner(): void {
  const banner = `
███████╗██╗   ██╗███████╗██╗  ██╗██╗
██╔════╝██║   ██║██╔════╝██║  ██║██║
███████╗██║   ██║███████╗███████║██║
╚════██║██║   ██║╚════██║██╔══██║██║
███████║╚██████╔╝███████║██║  ██║██║
╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝
`;

  console.log(chalk.hex("#d18b6a")(banner));
  console.log(chalk.bold("Build in public without context-switching.\n"));
}

function getGitUserName(): string {
  try {
    return execSync("git config user.name", { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

export const initCommand = new Command("init")
  .description("Initialize a new BiP configuration in the current project")
  .action(async () => {
    printSushiBanner();

    const bipDir = path.resolve(process.cwd(), ".bip");
    const configPath = path.join(bipDir, "config.yml");

    if (fs.existsSync(configPath)) {
      const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
        {
          type: "confirm",
          name: "overwrite",
          message:
            "A .bip/config.yml already exists. Do you want to overwrite it?",
          default: false,
        },
      ]);

      if (!overwrite) {
        console.log(chalk.yellow("Aborted. Existing config was not changed."));
        return;
      }
    }

    const answers = await inquirer.prompt<{
      name: string;
      platforms: string[];
      tone: string;
    }>([
      {
        type: "input",
        name: "name",
        message: "Your name:",
        default: getGitUserName() || undefined,
      },
      {
        type: "checkbox",
        name: "platforms",
        message: "Select platforms:",
        choices: [
          { name: "X (Twitter)", value: "x", checked: true },
          { name: "LinkedIn", value: "linkedin", checked: true },
        ],
        validate: (input: string[]) =>
          input.length > 0 ? true : "Select at least one platform.",
      },
      {
        type: "list",
        name: "tone",
        message: "Preferred tone:",
        choices: ["Technical", "Professional", "Casual"],
        default: "Casual",
      },
    ]);

    const config: BipConfig = {
      user: { name: answers.name },
      platforms: answers.platforms,
      tone: answers.tone.toLowerCase(),
    };

    fs.mkdirSync(bipDir, { recursive: true });
    fs.writeFileSync(configPath, yaml.dump(config), "utf-8");

    console.log(
      chalk.green("✔") + " BiP initialized successfully! Config written to .bip/config.yml"
    );
    console.log(
      chalk.dim(
        "Policy reminder: Sushi generates drafts only. Review and post manually, and follow platform rules (X, LinkedIn, Reddit)."
      )
    );
  });
