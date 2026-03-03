import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import yaml from "js-yaml";
import { loadConfig } from "../lib/config.js";

describe("loadConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bip-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfig(obj: unknown) {
    const bipDir = path.join(tmpDir, ".bip");
    fs.mkdirSync(bipDir, { recursive: true });
    fs.writeFileSync(path.join(bipDir, "config.yml"), yaml.dump(obj), "utf-8");
  }

  it("loads a valid config", () => {
    writeConfig({
      user: { name: "Alice" },
      platforms: ["x", "linkedin"],
      tone: "casual",
    });

    const config = loadConfig(tmpDir);
    expect(config.user.name).toBe("Alice");
    expect(config.platforms).toEqual(["x", "linkedin"]);
    expect(config.tone).toBe("casual");
  });

  it("throws when .bip/config.yml is missing", () => {
    expect(() => loadConfig(tmpDir)).toThrow("Run `npx @ayudb1304/sushi quickstart`");
  });

  it("throws when config is missing required fields", () => {
    writeConfig({ user: { name: "Bob" } });
    expect(() => loadConfig(tmpDir)).toThrow("malformed");
  });

  it("throws when user.name is not a string", () => {
    writeConfig({
      user: { name: 123 },
      platforms: ["x"],
      tone: "technical",
    });
    expect(() => loadConfig(tmpDir)).toThrow("user.name");
  });

  it("throws when platforms is empty", () => {
    writeConfig({
      user: { name: "Bob" },
      platforms: [],
      tone: "technical",
    });
    expect(() => loadConfig(tmpDir)).toThrow("non-empty array");
  });

  it("throws when tone is not a string", () => {
    writeConfig({
      user: { name: "Bob" },
      platforms: ["x"],
      tone: 42,
    });
    expect(() => loadConfig(tmpDir)).toThrow("tone");
  });
});
