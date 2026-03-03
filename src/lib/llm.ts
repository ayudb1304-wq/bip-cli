import { GoogleGenerativeAI } from "@google/generative-ai";
import type { DiffResult } from "./git-parser.js";
import type { BipConfig } from "./config.js";

export interface Narrative {
  problem: string;
  solution: string;
  risk: string;
  testingNotes: string;
}

export function buildPrompt(diff: DiffResult, config: BipConfig): string {
  const fileSummaries = diff.files
    .map(
      (f) =>
        `- **${f.filename}** (+${f.additions} / -${f.deletions})\n\`\`\`diff\n${f.rawDiff.slice(0, 3000)}\n\`\`\``
    )
    .join("\n\n");

  return `You are a developer storytelling assistant. Analyze the following Git commit and produce a JSON object describing what changed and why.

## Commit Metadata
- **SHA:** ${diff.commitSha}
- **Author:** ${diff.author}
- **Date:** ${diff.date}
- **Message:** ${diff.message}

## Changed Files
${fileSummaries}

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

export async function generateNarrative(
  diff: DiffResult,
  config: BipConfig
): Promise<Narrative> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to your .env file or export it as an environment variable."
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const prompt = buildPrompt(diff, config);
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
  return {
    problem: String(obj.problem ?? ""),
    solution: String(obj.solution ?? ""),
    risk: String(obj.risk ?? ""),
    testingNotes: String(obj.testingNotes ?? obj.testing_notes ?? ""),
  };
}
