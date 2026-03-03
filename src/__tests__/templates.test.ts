import { describe, it, expect } from "vitest";
import { renderDrafts, type Draft } from "../lib/templates.js";
import type { Narrative } from "../lib/llm.js";
import type { DiffResult } from "../lib/git-parser.js";
import type { BipConfig } from "../lib/config.js";

function makeNarrative(overrides?: Partial<Narrative>): Narrative {
  return {
    problem: "Auth tokens expired too quickly on mobile.",
    solution: "Increased token TTL from 5 to 15 minutes and added retry logic.",
    risk: "Longer TTL increases window for token theft.",
    testingNotes: "Verify mobile login flow and token refresh.",
    ...overrides,
  };
}

function makeDiff(overrides?: Partial<DiffResult>): DiffResult {
  return {
    commitSha: "abc12345",
    message: "fix: extend auth token TTL for mobile",
    author: "Ayush",
    date: "2026-03-01",
    files: [
      {
        filename: "src/auth/token.ts",
        additions: 5,
        deletions: 2,
        rawDiff: "diff --git a/src/auth/token.ts b/src/auth/token.ts ...",
      },
    ],
    ...overrides,
  };
}

function makeConfig(overrides?: Partial<BipConfig>): BipConfig {
  return {
    user: { name: "Ayush" },
    platforms: ["x", "linkedin"],
    tone: "technical",
    ...overrides,
  };
}

describe("renderDrafts", () => {
  it("produces one draft per platform in config", () => {
    const drafts = renderDrafts(makeNarrative(), makeDiff(), makeConfig());
    const platforms = drafts.map((d) => d.platform);
    expect(platforms).toEqual(["x", "linkedin"]);
  });

  it("produces only X draft when config has only x", () => {
    const drafts = renderDrafts(
      makeNarrative(),
      makeDiff(),
      makeConfig({ platforms: ["x"] })
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0].platform).toBe("x");
  });

  it("produces only LinkedIn draft when config has only linkedin", () => {
    const drafts = renderDrafts(
      makeNarrative(),
      makeDiff(),
      makeConfig({ platforms: ["linkedin"] })
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0].platform).toBe("linkedin");
  });

  it("X draft contains the problem and solution", () => {
    const drafts = renderDrafts(makeNarrative(), makeDiff(), makeConfig());
    const xDraft = drafts.find((d) => d.platform === "x")!;
    expect(xDraft.content).toContain("Auth tokens expired");
    expect(xDraft.content).toContain("token TTL");
  });

  it("X draft includes #buildinpublic hashtag", () => {
    const drafts = renderDrafts(makeNarrative(), makeDiff(), makeConfig());
    const xDraft = drafts.find((d) => d.platform === "x")!;
    expect(xDraft.content).toContain("#buildinpublic");
  });

  it("LinkedIn draft includes build log header and author name", () => {
    const drafts = renderDrafts(makeNarrative(), makeDiff(), makeConfig());
    const liDraft = drafts.find((d) => d.platform === "linkedin")!;
    expect(liDraft.content).toContain("Build Log");
    expect(liDraft.content).toContain("Ayush");
    expect(liDraft.content).toContain("The Problem");
    expect(liDraft.content).toContain("What Changed");
  });

  it("LinkedIn draft includes risk section when risk is meaningful", () => {
    const drafts = renderDrafts(makeNarrative(), makeDiff(), makeConfig());
    const liDraft = drafts.find((d) => d.platform === "linkedin")!;
    expect(liDraft.content).toContain("Risks & Tradeoffs");
  });

  it("LinkedIn draft omits risk section when risk is 'No obvious risks.'", () => {
    const narrative = makeNarrative({ risk: "No obvious risks." });
    const drafts = renderDrafts(narrative, makeDiff(), makeConfig());
    const liDraft = drafts.find((d) => d.platform === "linkedin")!;
    expect(liDraft.content).not.toContain("Risks & Tradeoffs");
  });

  it("applies casual tone to X draft", () => {
    const drafts = renderDrafts(
      makeNarrative(),
      makeDiff(),
      makeConfig({ tone: "casual" })
    );
    const xDraft = drafts.find((d) => d.platform === "x")!;
    expect(xDraft.content).toContain("So I ran into this:");
  });

  it("applies professional tone to X draft", () => {
    const drafts = renderDrafts(
      makeNarrative(),
      makeDiff(),
      makeConfig({ tone: "professional" })
    );
    const xDraft = drafts.find((d) => d.platform === "x")!;
    expect(xDraft.content).toContain("Identified an issue:");
  });

  it("skips unknown platforms gracefully", () => {
    const drafts = renderDrafts(
      makeNarrative(),
      makeDiff(),
      makeConfig({ platforms: ["mastodon" as string] })
    );
    expect(drafts).toEqual([]);
  });

  it("truncates very large file lists with a summary suffix", () => {
    const manyFiles = Array.from({ length: 12 }, (_, i) => ({
      filename: `src/file-${i}.ts`,
      additions: i + 1,
      deletions: i,
      rawDiff: `diff --git a/src/file-${i}.ts b/src/file-${i}.ts`,
    }));

    const drafts = renderDrafts(
      makeNarrative(),
      makeDiff({ files: manyFiles }),
      makeConfig({ platforms: ["linkedin"] })
    );
    const liDraft = drafts[0];
    expect(liDraft.content).toContain("...and 4 more file(s)");
  });
});
