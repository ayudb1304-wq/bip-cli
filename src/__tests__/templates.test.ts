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

  it("ensures each X thread part is within 280 characters", () => {
    const narrative = makeNarrative({
      problem:
        "Auth tokens expired too quickly on mobile clients during unstable network retries, which broke login continuity for users in transit and made sessions feel unreliable.",
      solution:
        "Increased token TTL from 5 to 15 minutes, added retry logic with clearer fallback handling, and tightened guard clauses around stale refresh payloads to keep auth behavior stable under jitter.",
      risk:
        "Longer TTL increases the window for token misuse if a token is leaked, so monitoring and revocation paths should stay sharp while this ships.",
      testingNotes:
        "Verify mobile login and refresh flows under flaky network conditions, retry storms, and expired token paths to confirm no regressions in auth state transitions.",
    });

    const drafts = renderDrafts(narrative, makeDiff(), makeConfig({ platforms: ["x"] }));
    const xDraft = drafts[0];
    expect(xDraft.threadParts && xDraft.threadParts.length > 0).toBe(true);
    for (const part of xDraft.threadParts ?? []) {
      expect(part.length).toBeLessThanOrEqual(280);
    }
  });

  it("LinkedIn draft includes build log header and author name", () => {
    const drafts = renderDrafts(makeNarrative(), makeDiff(), makeConfig());
    const liDraft = drafts.find((d) => d.platform === "linkedin")!;
    expect(liDraft.content).toContain("## Build Update");
    expect(liDraft.content).toContain("Ayush");
    expect(liDraft.content).toContain("## Milestones");
    expect(liDraft.content).toContain("## Validation");
  });

  it("LinkedIn draft includes risk line when risk is meaningful", () => {
    const drafts = renderDrafts(makeNarrative(), makeDiff(), makeConfig());
    const liDraft = drafts.find((d) => d.platform === "linkedin")!;
    expect(liDraft.content).toContain("## Risks and Follow-up");
  });

  it("LinkedIn draft omits risk line when risk is 'No obvious risks.'", () => {
    const narrative = makeNarrative({ risk: "No obvious risks." });
    const drafts = renderDrafts(narrative, makeDiff(), makeConfig());
    const liDraft = drafts.find((d) => d.platform === "linkedin")!;
    expect(liDraft.content).not.toContain("One risk:");
  });

  it("applies casual tone to X draft", () => {
    const drafts = renderDrafts(
      makeNarrative(),
      makeDiff(),
      makeConfig({ tone: "casual" })
    );
    const xDraft = drafts.find((d) => d.platform === "x")!;
    expect(xDraft.content).toContain("Ran into this today:");
  });

  it("applies professional tone to X draft", () => {
    const drafts = renderDrafts(
      makeNarrative(),
      makeDiff(),
      makeConfig({ tone: "professional" })
    );
    const xDraft = drafts.find((d) => d.platform === "x")!;
    expect(xDraft.content).toContain("I ran into this:");
  });

  it("skips unknown platforms gracefully", () => {
    const drafts = renderDrafts(
      makeNarrative(),
      makeDiff(),
      makeConfig({ platforms: ["mastodon" as string] })
    );
    expect(drafts).toEqual([]);
  });

  it("does not include files touched line in linkedin draft", () => {
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
    expect(liDraft.content).not.toContain("Files touched:");
  });

  it("keeps linkedin draft within 300-400 words", () => {
    const drafts = renderDrafts(
      makeNarrative(),
      makeDiff(),
      makeConfig({ platforms: ["linkedin"] })
    );
    const words = drafts[0].content.trim().split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(300);
    expect(words).toBeLessThanOrEqual(400);
  });

  it("removes em dashes from output", () => {
    const drafts = renderDrafts(
      makeNarrative({ solution: "Updated auth flow — no downtime rollout." }),
      makeDiff(),
      makeConfig({ platforms: ["linkedin"] })
    );
    expect(drafts[0].content).not.toContain("—");
  });
});
