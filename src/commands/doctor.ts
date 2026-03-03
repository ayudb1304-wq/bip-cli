import { Command } from "commander";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { reportCommandError } from "../lib/monitoring.js";

type CheckResult = {
  label: string;
  ok: boolean;
  detail: string;
};

function runCheck(label: string, fn: () => string): CheckResult {
  try {
    return { label, ok: true, detail: fn() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { label, ok: false, detail: message };
  }
}

export const doctorCommand = new Command("doctor")
  .description("Check onboarding prerequisites and suggest next steps")
  .action(() => {
    try {
      const cwd = process.cwd();
      const checks: CheckResult[] = [
        runCheck("Node.js", () => process.version),
        runCheck("Git installed", () =>
          execSync("git --version", {
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "ignore"],
          }).trim()
        ),
        runCheck("Inside Git repository", () => {
          const out = execSync("git rev-parse --is-inside-work-tree", {
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "ignore"],
          }).trim();
          if (out !== "true") throw new Error("Not in a Git repo");
          return "yes";
        }),
        runCheck(".bip/config.yml", () => {
          const configPath = path.join(cwd, ".bip", "config.yml");
          if (!fs.existsSync(configPath)) {
            throw new Error("Missing. Run `npx @ayudb1304/sushi quickstart`");
          }
          return "found";
        }),
        runCheck("GEMINI_API_KEY", () => {
          if (!process.env.GEMINI_API_KEY) {
            throw new Error("Missing. Demo mode still works via `npx @ayudb1304/sushi quickstart`");
          }
          return "set";
        }),
      ];

      const hasFailure = checks.some((check) => !check.ok);
      for (const check of checks) {
        const icon = check.ok ? chalk.green("✔") : chalk.yellow("!");
        const line = `${icon} ${check.label}: ${check.detail}`;
        console.log(line);
      }

      console.log();
      if (hasFailure) {
        console.log(
          chalk.cyan(
            "Quick fix: run `npx @ayudb1304/sushi quickstart` for an instant demo, then add GEMINI_API_KEY for real AI drafts."
          )
        );
      } else {
        console.log(chalk.green("All checks passed. You are ready for full real-mode generation."));
      }
    } catch (error) {
      reportCommandError("doctor", error);
      throw error;
    }
  });
