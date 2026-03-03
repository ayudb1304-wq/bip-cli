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
const MAX_PROMPT_FILES = 6;
const MAX_DIFF_CHARS_PER_FILE = 1200;

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
  const selectedFiles = diff.files.slice(0, MAX_PROMPT_FILES);
  const omittedFiles = diff.files.length - selectedFiles.length;
  const fileSummaries = selectedFiles
    .map(
      (f) =>
        `- **${f.filename}** (+${f.additions} / -${f.deletions})\n\`\`\`diff\n${f.rawDiff.slice(0, MAX_DIFF_CHARS_PER_FILE)}\n\`\`\``
    )
    .join("\n\n");
  const omittedFilesNote =
    omittedFiles > 0
      ? `\n- Additional changed files omitted for token budget: ${omittedFiles}`
      : "";

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
${omittedFilesNote}
${memorySection}

## Instructions
1. Infer the **problem** this commit addresses from the commit message, file names, and code changes. If the purpose is unclear, say "Likely..." and be explicit about uncertainty.
2. Describe the **solution** in plain language, grounded in the actual code changes.
3. Identify **risk** in one concise line. If there is no clear risk, say "No obvious risks."
4. Suggest **testing notes** in one concise line.

## Constraints
- You may ONLY reference files, functions, and entities present in the diff above.
- Do NOT invent features, metrics, user counts, or revenue figures.
- Do NOT mention technologies or components that are not visible in the context.
- Keep the developer's preferred tone in mind: **${config.tone}** (default to casual and human sounding).
- Keep language natural and personal, without AI buzzwords or hype.
- No em dashes.
- Keep each field under 35 words.
- Keep total JSON text under 140 words.

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
      "GEMINI_API_KEY is not set. Run `npx @ayudb1304/sushi quickstart` for demo mode, or add GEMINI_API_KEY to your .env file for real AI drafts."
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
