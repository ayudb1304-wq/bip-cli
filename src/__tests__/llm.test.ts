import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildPrompt,
  generateNarrative,
  generateNarrativeWithTelemetry,
} from "../lib/llm.js";
import type { DiffResult } from "../lib/git-parser.js";
import type { BipConfig } from "../lib/config.js";

function makeDiff(): DiffResult {
  return {
    commitSha: "abc12345def67890",
    message: "fix: handle null user in profile endpoint",
    author: "Ayush",
    date: "2026-03-01",
    files: [
      {
        filename: "src/routes/profile.ts",
        additions: 3,
        deletions: 1,
        rawDiff:
          "diff --git a/src/routes/profile.ts b/src/routes/profile.ts\n+  if (!user) return res.status(404).json({ error: 'not found' });\n-  const name = user.name;",
      },
    ],
  };
}

function makeConfig(): BipConfig {
  return {
    user: { name: "Ayush" },
    platforms: ["x", "linkedin"],
    tone: "technical",
  };
}

describe("buildPrompt", () => {
  it("includes commit metadata", () => {
    const prompt = buildPrompt(makeDiff(), makeConfig());
    expect(prompt).toContain("abc12345def67890");
    expect(prompt).toContain("Ayush");
    expect(prompt).toContain("fix: handle null user");
  });

  it("includes file diffs", () => {
    const prompt = buildPrompt(makeDiff(), makeConfig());
    expect(prompt).toContain("src/routes/profile.ts");
    expect(prompt).toContain("+3");
    expect(prompt).toContain("-1");
  });

  it("includes anti-hallucination constraints", () => {
    const prompt = buildPrompt(makeDiff(), makeConfig());
    expect(prompt).toContain("ONLY reference");
    expect(prompt).toContain("Do NOT invent");
    expect(prompt).toContain("unclear");
  });

  it("includes tone from config", () => {
    const prompt = buildPrompt(makeDiff(), makeConfig());
    expect(prompt).toContain("technical");
  });

  it("includes narrative memory when provided", () => {
    const prompt = buildPrompt(
      makeDiff(),
      makeConfig(),
      "- [abc12345] Previous work\n  Problem: Something broke\n  Solution: We fixed it"
    );
    expect(prompt).toContain("Narrative Memory");
    expect(prompt).toContain("Previous work");
  });

  it("requests JSON output format", () => {
    const prompt = buildPrompt(makeDiff(), makeConfig());
    expect(prompt).toContain('"problem"');
    expect(prompt).toContain('"solution"');
    expect(prompt).toContain('"risk"');
    expect(prompt).toContain('"testingNotes"');
  });
});

describe("generateNarrative", () => {
  const mockResponse = {
    problem: "Null user caused crash on profile endpoint.",
    solution: "Added null check with 404 response.",
    risk: "No obvious risks.",
    testingNotes: "Test profile endpoint with invalid user ID.",
  };

  beforeEach(() => {
    vi.resetModules();
  });

  it("throws when GEMINI_API_KEY is not set", async () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    await expect(generateNarrative(makeDiff(), makeConfig())).rejects.toThrow(
      "GEMINI_API_KEY"
    );

    if (original) process.env.GEMINI_API_KEY = original;
  });

  it("parses valid JSON response from Gemini", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    vi.mocked;

    vi.spyOn(
      GoogleGenerativeAI.prototype,
      "getGenerativeModel"
    ).mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      }),
    } as any);

    const narrative = await generateNarrative(makeDiff(), makeConfig());
    expect(narrative.problem).toBe(mockResponse.problem);
    expect(narrative.solution).toBe(mockResponse.solution);
    expect(narrative.risk).toBe(mockResponse.risk);
    expect(narrative.testingNotes).toBe(mockResponse.testingNotes);

    delete process.env.GEMINI_API_KEY;
  });

  it("throws on invalid JSON response", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const { GoogleGenerativeAI } = await import("@google/generative-ai");

    vi.spyOn(
      GoogleGenerativeAI.prototype,
      "getGenerativeModel"
    ).mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => "This is not JSON at all",
        },
      }),
    } as any);

    await expect(generateNarrative(makeDiff(), makeConfig())).rejects.toThrow(
      "invalid JSON"
    );

    delete process.env.GEMINI_API_KEY;
  });

  it("returns telemetry estimates", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const { GoogleGenerativeAI } = await import("@google/generative-ai");

    vi.spyOn(
      GoogleGenerativeAI.prototype,
      "getGenerativeModel"
    ).mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      }),
    } as any);

    const result = await generateNarrativeWithTelemetry(makeDiff(), makeConfig());
    expect(result.telemetry.model).toBe("gemini-2.5-flash");
    expect(result.telemetry.inputTokensEstimate).toBeGreaterThan(0);
    expect(result.telemetry.outputTokensEstimate).toBeGreaterThan(0);
    expect(result.telemetry.estimatedCostUsd).toBeGreaterThan(0);

    delete process.env.GEMINI_API_KEY;
  });
});
