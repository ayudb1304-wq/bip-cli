import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

export interface BipConfig {
  user: { name: string };
  platforms: string[];
  tone: string;
}

export function loadConfig(cwd?: string): BipConfig {
  const base = cwd ?? process.cwd();
  const configPath = path.join(base, ".bip", "config.yml");

  if (!fs.existsSync(configPath)) {
    throw new Error(
      "No .bip/config.yml found. Run `sushi init` or `npx @ayudb1304/sushi init` first."
    );
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = yaml.load(raw);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("user" in parsed) ||
    !("platforms" in parsed) ||
    !("tone" in parsed)
  ) {
    throw new Error(
      ".bip/config.yml is malformed. Expected fields: user.name, platforms, tone."
    );
  }

  const config = parsed as Record<string, unknown>;
  const user = config.user as Record<string, unknown> | undefined;

  if (!user || typeof user.name !== "string") {
    throw new Error(
      ".bip/config.yml is malformed. 'user.name' must be a string."
    );
  }

  if (!Array.isArray(config.platforms) || config.platforms.length === 0) {
    throw new Error(
      ".bip/config.yml is malformed. 'platforms' must be a non-empty array."
    );
  }

  if (typeof config.tone !== "string") {
    throw new Error(
      ".bip/config.yml is malformed. 'tone' must be a string."
    );
  }

  return {
    user: { name: user.name },
    platforms: config.platforms as string[],
    tone: config.tone as string,
  };
}
