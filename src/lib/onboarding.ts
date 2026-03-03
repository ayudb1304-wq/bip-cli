import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import yaml from "js-yaml";
import { loadConfig } from "./config.js";
import type { BipConfig } from "./config.js";
import type { DiffResult } from "./git-parser.js";
import type { Narrative } from "./llm.js";

export interface EnsureConfigResult {
  config: BipConfig;
  configPath: string;
  created: boolean;
}

function getGitUserName(cwd: string): string {
  try {
    return execSync("git config user.name", {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

export function buildDefaultConfig(name?: string, cwd = process.cwd()): BipConfig {
  const fallbackName = getGitUserName(cwd) || "Builder";
  return {
    user: { name: name?.trim() || fallbackName },
    platforms: ["x", "linkedin"],
    tone: "casual",
  };
}

export function ensureConfig(cwd = process.cwd(), name?: string): EnsureConfigResult {
  const bipDir = path.resolve(cwd, ".bip");
  const configPath = path.join(bipDir, "config.yml");

  if (fs.existsSync(configPath)) {
    return {
      config: loadConfig(cwd),
      configPath,
      created: false,
    };
  }

  const config = buildDefaultConfig(name, cwd);
  fs.mkdirSync(bipDir, { recursive: true });
  fs.writeFileSync(configPath, yaml.dump(config), "utf-8");
  return {
    config,
    configPath,
    created: true,
  };
}

export function buildSyntheticDiff(cwd = process.cwd()): DiffResult {
  const now = new Date().toISOString();
  const projectName = path.basename(cwd) || "your-project";
  return {
    commitSha: "demo0000",
    message: `Initial build-in-public setup for ${projectName}`,
    author: "You",
    date: now,
    files: [
      {
        filename: "README.md",
        additions: 6,
        deletions: 0,
        rawDiff: `diff --git a/README.md b/README.md\n+ Added project intro\n+ Added quick goals`,
      },
    ],
  };
}

function listTopFiles(diff: DiffResult, max = 3): string {
  const top = [...diff.files]
    .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))
    .slice(0, max)
    .map((file) => file.filename);
  return top.length > 0 ? top.join(", ") : "core project files";
}

export function buildDemoNarrative(diff: DiffResult): Narrative {
  const fileCount = diff.files.length;
  const additions = diff.files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = diff.files.reduce((sum, file) => sum + file.deletions, 0);
  const focusFiles = listTopFiles(diff);
  const commitSummary = diff.message || "latest project update";

  return {
    problem: `I wanted to share clear progress from "${commitSummary}" without writing from scratch.`,
    solution: `I summarized ${fileCount} changed file(s) (+${additions}/-${deletions}) and focused the story on ${focusFiles}.`,
    risk: "Demo mode uses local heuristics, so details can be less precise than real AI generation.",
    testingNotes: "Switch to real mode with a Gemini key, then run quickstart again for richer drafts.",
  };
}
