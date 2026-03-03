import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildMemoryContext,
  getNarrativeMemoryPath,
  loadNarrativeMemory,
  saveNarrativeMemoryEntry,
} from "../lib/memory.js";
import type { DiffResult } from "../lib/git-parser.js";

function makeDiff(overrides?: Partial<DiffResult>): DiffResult {
  return {
    commitSha: "abc12345def67890",
    message: "feat: improve auth session handling",
    author: "Ayush",
    date: "2026-03-03",
    files: [
      {
        filename: "src/auth/session.ts",
        additions: 6,
        deletions: 2,
        rawDiff: "diff --git a/src/auth/session.ts b/src/auth/session.ts",
      },
    ],
    ...overrides,
  };
}

describe("narrative memory", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bip-memory-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty memory when file is missing", () => {
    expect(loadNarrativeMemory(tmpDir)).toEqual([]);
  });

  it("saves and reloads memory entries", () => {
    const entries = saveNarrativeMemoryEntry(
      makeDiff(),
      {
        problem: "Session refresh failed after idle period.",
        solution: "Added fallback refresh path and retry guard.",
        risk: "No obvious risks.",
        testingNotes: "Test idle refresh after 15 minutes.",
      },
      tmpDir
    );

    expect(entries).toHaveLength(1);
    const loaded = loadNarrativeMemory(tmpDir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].commitSha).toBe("abc12345def67890");
    expect(fs.existsSync(getNarrativeMemoryPath(tmpDir))).toBe(true);
  });

  it("deduplicates memory by commit SHA", () => {
    saveNarrativeMemoryEntry(
      makeDiff(),
      {
        problem: "Old problem",
        solution: "Old solution",
        risk: "No obvious risks.",
        testingNotes: "Old tests",
      },
      tmpDir
    );

    const updated = saveNarrativeMemoryEntry(
      makeDiff(),
      {
        problem: "Updated problem",
        solution: "Updated solution",
        risk: "No obvious risks.",
        testingNotes: "Updated tests",
      },
      tmpDir
    );

    expect(updated).toHaveLength(1);
    expect(updated[0].problem).toBe("Updated problem");
  });

  it("builds continuity context with overlapping files first", () => {
    saveNarrativeMemoryEntry(
      makeDiff({
        commitSha: "11111111aaaa",
        message: "feat: auth session baseline",
      }),
      {
        problem: "Session state drifted.",
        solution: "Introduced normalized session payload.",
        risk: "No obvious risks.",
        testingNotes: "Validate schema migrations.",
      },
      tmpDir
    );

    saveNarrativeMemoryEntry(
      makeDiff({
        commitSha: "22222222bbbb",
        message: "feat: billing webhook retries",
        files: [
          {
            filename: "src/billing/webhook.ts",
            additions: 8,
            deletions: 1,
            rawDiff: "diff --git a/src/billing/webhook.ts b/src/billing/webhook.ts",
          },
        ],
      }),
      {
        problem: "Webhook retries were missing.",
        solution: "Added retry strategy with backoff.",
        risk: "No obvious risks.",
        testingNotes: "Replay failed webhook events.",
      },
      tmpDir
    );

    const memory = loadNarrativeMemory(tmpDir);
    const context = buildMemoryContext(makeDiff(), memory);
    expect(context).toContain("feat: auth session baseline");
    expect(context).not.toContain("feat: billing webhook retries");
  });
});
