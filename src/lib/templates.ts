import type { Narrative } from "./llm.js";
import type { DiffResult } from "./git-parser.js";
import type { BipConfig } from "./config.js";

export interface Draft {
  platform: string;
  content: string;
  threadParts?: string[];
}

const X_CHAR_LIMIT = 280;

type ToneStyle = {
  opener: (problem: string) => string;
  solutionPrefix: string;
  riskPrefix: string;
  closingTag?: string;
};

const TONE_STYLES: Record<string, ToneStyle> = {
  technical: {
    opener: (p) => `I hit this issue: ${p}`,
    solutionPrefix: "I fixed it by",
    riskPrefix: "One risk",
  },
  professional: {
    opener: (p) => `I ran into this: ${p}`,
    solutionPrefix: "I addressed it by",
    riskPrefix: "One thing to watch",
  },
  casual: {
    opener: (p) => `Ran into this today: ${p}`,
    solutionPrefix: "I fixed it by",
    riskPrefix: "One thing to watch",
  },
};

function getTone(tone: string): ToneStyle {
  return TONE_STYLES[tone] ?? TONE_STYLES.casual;
}

function toWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function splitIntoSentences(text: string): string[] {
  const cleaned = sanitizeHumanText(text);
  const matches = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  return matches.map((part) => part.trim()).filter(Boolean);
}

function clampWords(text: string, maxWords: number): string {
  const words = toWords(text);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function sanitizeHumanText(text: string): string {
  return text
    .replace(/—/g, "-")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .trim();
}

function wordCount(text: string): number {
  return toWords(text).length;
}

function trimToMaxWordsKeepFormatting(text: string, maxWords: number): string {
  const normalized = sanitizeHumanText(text);
  if (wordCount(normalized) <= maxWords) return normalized;

  const tokens = normalized.split(/(\s+)/);
  let used = 0;
  const out: string[] = [];

  for (const token of tokens) {
    if (token.trim().length === 0) {
      out.push(token);
      continue;
    }
    if (used >= maxWords) break;
    out.push(token);
    used += 1;
  }

  return `${out.join("").trim()}...`;
}

function ensureWordRange(
  text: string,
  minWords: number,
  maxWords: number,
  fillBlocks: string[]
): string {
  let current = sanitizeHumanText(text);

  for (const block of fillBlocks) {
    if (wordCount(current) >= minWords) break;
    current = `${current}\n\n${sanitizeHumanText(block)}`;
  }

  return trimToMaxWordsKeepFormatting(current, maxWords);
}

function shortenToLimit(text: string, limit: number): string {
  if (text.length <= limit) return text;
  if (limit <= 3) return text.slice(0, limit);
  return `${text.slice(0, limit - 3).trimEnd()}...`;
}

function toXThreadParts(lines: string[]): string[] {
  const parts: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim().length > 0) {
      parts.push(current.trim());
      current = "";
    }
  };

  for (const line of lines) {
    const trimmed = sanitizeHumanText(line);
    if (!trimmed) continue;

    if (trimmed.length > X_CHAR_LIMIT) {
      pushCurrent();
      const sentences = splitIntoSentences(trimmed);
      let sentenceBuffer = "";

      for (const sentence of sentences) {
        const candidate = sentenceBuffer ? `${sentenceBuffer} ${sentence}` : sentence;
        if (candidate.length <= X_CHAR_LIMIT) {
          sentenceBuffer = candidate;
          continue;
        }

        if (sentenceBuffer) {
          parts.push(sentenceBuffer);
        }

        if (sentence.length <= X_CHAR_LIMIT) {
          sentenceBuffer = sentence;
        } else {
          parts.push(shortenToLimit(sentence, X_CHAR_LIMIT));
          sentenceBuffer = "";
        }
      }

      if (sentenceBuffer) {
        parts.push(sentenceBuffer);
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${trimmed}` : trimmed;
    if (candidate.length <= X_CHAR_LIMIT) {
      current = candidate;
    } else {
      pushCurrent();
      current = trimmed;
    }
  }

  pushCurrent();
  return parts.length > 0 ? parts : [""];
}

function renderX(
  narrative: Narrative,
  tone: ToneStyle
): Draft {
  const lines = [
    tone.opener(narrative.problem),
    `${tone.solutionPrefix} ${narrative.solution}`,
    narrative.risk !== "No obvious risks."
      ? `${tone.riskPrefix}: ${narrative.risk}`
      : "Risk: no obvious risks right now.",
    narrative.testingNotes ? `Quick test: ${narrative.testingNotes}` : "",
    tone.closingTag ?? "",
  ].filter((line) => line.trim().length > 0);

  const threadParts = toXThreadParts(lines);
  return {
    platform: "x",
    content: threadParts.join("\n\n"),
    threadParts,
  };
}

function renderLinkedIn(
  narrative: Narrative,
  diff: DiffResult,
  config: BipConfig,
  tone: ToneStyle
): Draft {
  const conciseProblem = clampWords(narrative.problem, 34);
  const conciseSolution = clampWords(narrative.solution, 42);
  const conciseRisk = clampWords(narrative.risk, 26);
  const conciseTests = clampWords(narrative.testingNotes, 28);
  const commitShort = diff.commitSha.slice(0, 8);

  const core = [
    `## Build Update`,
    ``,
    `This week I shipped: **${sanitizeHumanText(diff.message)}**`,
    ``,
    `## Context`,
    `- ${tone.opener(conciseProblem)}`,
    `- ${tone.solutionPrefix} ${conciseSolution}.`,
    `- Commit: \`${commitShort}\``,
    ``,
    `## Milestones`,
    `- **Milestone 1:** scoped the issue to a concrete failure point and kept the change focused.`,
    `- **Milestone 2:** shipped the main fix in code and verified the behavior stayed stable.`,
    `- **Milestone 3:** documented tradeoffs so follow-up work has clear context.`,
    `- **Milestone 4:** kept the rollout human-reviewed before posting externally.`,
    ``,
    `## Validation`,
    `- Ran targeted checks for the exact path that changed.`,
    `- Quick test plan: ${conciseTests || "verified happy path and edge cases manually."}`,
    `- Confirmed no obvious regressions in adjacent flows.`,
    ``,
    `## Risks and Follow-up`,
    ...(narrative.risk && narrative.risk !== "No obvious risks."
      ? [`- ${tone.riskPrefix}: ${conciseRisk}`]
      : [`- No obvious risks right now, but I am monitoring this path closely.`]),
    `- Next step: tighten edge-case coverage and keep this thread updated with outcomes.`,
    ``,
    `## Why this matters`,
    `- The goal is simple: ship useful progress, explain it clearly, and keep momentum visible.`,
    `- I want this to read like a real build log, not polished marketing copy.`,
    ``,
    `- ${config.user.name}`,
  ].join("\n");

  const fillBlocks = [
    [
      `## Extra Notes`,
      `- I kept the scope narrow so the change is easy to reason about.`,
      `- I used small checkpoints while implementing so rollback stays simple if needed.`,
      `- I am tracking this as part of a longer milestone, so continuity between updates matters.`,
      `- I prefer explicit tradeoffs over vague claims because it keeps the log trustworthy.`,
    ].join("\n"),
    [
      `## What I learned`,
      `- Clear framing of the problem made implementation faster than expected.`,
      `- The biggest win was reducing ambiguity in follow-up work.`,
      `- Writing this in bullet points makes it easier to reuse as status updates elsewhere.`,
      `- I will keep using this format for future build-in-public posts.`,
    ].join("\n"),
  ];

  return {
    platform: "linkedin",
    content: ensureWordRange(core, 300, 400, fillBlocks),
  };
}

export function renderDrafts(
  narrative: Narrative,
  diff: DiffResult,
  config: BipConfig
): Draft[] {
  const tone = getTone(config.tone);
  const drafts: Draft[] = [];

  for (const platform of config.platforms) {
    switch (platform) {
      case "x":
        drafts.push(renderX(narrative, tone));
        break;
      case "linkedin":
        drafts.push(renderLinkedIn(narrative, diff, config, tone));
        break;
      default:
        break;
    }
  }

  return drafts;
}
