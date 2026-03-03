import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildDemoNarrative, buildSyntheticDiff, ensureConfig } from "../lib/onboarding.js";
import type { DiffResult } from "../lib/git-parser.js";

describe("onboarding helpers", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bip-onboarding-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates default config when missing", () => {
    const result = ensureConfig(tmpDir);
    expect(result.created).toBe(true);
    expect(result.config.tone).toBe("casual");
    expect(result.config.platforms).toEqual(["x", "linkedin"]);
    expect(fs.existsSync(path.join(tmpDir, ".bip", "config.yml"))).toBe(true);
  });

  it("reuses existing config when present", () => {
    fs.mkdirSync(path.join(tmpDir, ".bip"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".bip", "config.yml"),
      "user:\n  name: Alex\nplatforms:\n  - x\ntone: technical\n",
      "utf-8"
    );

    const result = ensureConfig(tmpDir);
    expect(result.created).toBe(false);
    expect(result.config.user.name).toBe("Alex");
    expect(result.config.tone).toBe("technical");
  });

  it("builds a beginner-friendly demo narrative", () => {
    const diff: DiffResult = {
      commitSha: "abc123456789",
      message: "feat: add dashboard status cards",
      author: "Alex",
      date: "2026-03-03",
      files: [
        { filename: "src/a.ts", additions: 5, deletions: 1, rawDiff: "diff --git ..." },
        { filename: "src/b.ts", additions: 3, deletions: 2, rawDiff: "diff --git ..." },
      ],
    };

    const narrative = buildDemoNarrative(diff);
    expect(narrative.problem).toContain("feat: add dashboard status cards");
    expect(narrative.solution).toContain("2 changed file(s)");
    expect(narrative.risk).toContain("Demo mode");
  });

  it("creates a synthetic diff fallback", () => {
    const diff = buildSyntheticDiff(tmpDir);
    expect(diff.commitSha).toBe("demo0000");
    expect(diff.files.length).toBeGreaterThan(0);
    expect(diff.message).toContain(path.basename(tmpDir));
  });
});
