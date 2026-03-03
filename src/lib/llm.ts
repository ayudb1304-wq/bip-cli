import { GoogleGenerativeAI } from "@google/generative-ai";
import type { DiffResult } from "./git-parser.js";
import type { BipConfig } from "./config.js";

export interface Narrative {
  problem: string;
  solution: string;
  risk: string;
  testingNotes: string;
}

export interface LlmTelemetry {
  model: string;
  inputTokensEstimate: number;
  outputTokensEstimate: number;
  estimatedCostUsd: number;
}

const MODEL_NAME = "gemini-2.5-flash";
const INPUT_COST_PER_MILLION = 0.3;
const OUTPUT_COST_PER_MILLION = 2.5;

function estimateTokens(text: string): number {
  // Fast approximation for rough cost tracking.
  return Math.max(1, Math.ceil(text.length / 4));
}

function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * INPUT_COST_PER_MILLION;
  const outputCost = (outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION;
  return Number((inputCost + outputCost).toFixed(6));
}

export function buildPrompt(
  diff: DiffResult,
  config: BipConfig,
  memoryContext = ""
): string {
  const fileSummaries = diff.files
    .map(
      (f) =>
        `- **${f.filename}** (+${f.additions} / -${f.deletions})\n\`\`\`diff\n${f.rawDiff.slice(0, 3000)}\n\`\`\``
    )
    .join("\n\n");

  const memorySection = memoryContext
    ? `\n## Narrative Memory (Recent Context)\n${memoryContext}\n`
    : "";

  return `You are a developer storytelling assistant. Analyze the following Git commit and produce a JSON object describing what changed and why.

## Commit Metadata
- **SHA:** ${diff.commitSha}
- **Author:** ${diff.author}
- **Date:** ${diff.date}
- **Message:** ${diff.message}

## Changed Files
${fileSummaries}
${memorySection}

## Instructions
1. Infer the **problem** this commit addresses from the commit message, file names, and code changes. If the purpose is unclear, say "Not explicitly stated, but likely..." rather than inventing a backstory.
2. Describe the **solution** in terms of user/system impact and the specific code changes made.
3. Identify any **risks** introduced by this change (e.g., breaking changes, missing error handling, performance concerns). If none are apparent, say "No obvious risks."
4. Suggest **testing notes** — what should be tested or verified to confirm this change works correctly.

## Constraints
- You may ONLY reference files, functions, and entities present in the diff above.
- Do NOT invent features, metrics, user counts, or revenue figures.
- Do NOT mention technologies or components that are not visible in the context.
- Keep the developer's preferred tone in mind: **${config.tone}**.

## Required Output Format
Respond with ONLY a JSON object (no markdown fences, no extra text):
{
  "problem": "...",
  "solution": "...",
  "risk": "...",
  "testingNotes": "..."
}`;
}

export async function generateNarrativeWithTelemetry(
  diff: DiffResult,
  config: BipConfig,
  memoryContext = ""
): Promise<{ narrative: Narrative; telemetry: LlmTelemetry }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to your .env file or export it as an environment variable."
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const prompt = buildPrompt(diff, config, memoryContext);
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `Gemini returned invalid JSON. Raw response:\n${text.slice(0, 500)}`
    );
  }

  const obj = parsed as Record<string, unknown>;
  const narrative: Narrative = {
    problem: String(obj.problem ?? ""),
    solution: String(obj.solution ?? ""),
    risk: String(obj.risk ?? ""),
    testingNotes: String(obj.testingNotes ?? obj.testing_notes ?? ""),
  };

  const inputTokensEstimate = estimateTokens(prompt);
  const outputTokensEstimate = estimateTokens(text);
  const telemetry: LlmTelemetry = {
    model: MODEL_NAME,
    inputTokensEstimate,
    outputTokensEstimate,
    estimatedCostUsd: estimateCostUsd(inputTokensEstimate, outputTokensEstimate),
  };

  return { narrative, telemetry };
}

export async function generateNarrative(
  diff: DiffResult,
  config: BipConfig,
  memoryContext = ""
): Promise<Narrative> {
  const { narrative } = await generateNarrativeWithTelemetry(diff, config, memoryContext);
  return narrative;
}
