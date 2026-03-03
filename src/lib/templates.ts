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
  closingTag: string;
};

const TONE_STYLES: Record<string, ToneStyle> = {
  technical: {
    opener: (p) => `Bug: ${p}`,
    solutionPrefix: "Fix:",
    riskPrefix: "Risk:",
    closingTag: "#buildinpublic #devlog",
  },
  professional: {
    opener: (p) => `Identified an issue: ${p}`,
    solutionPrefix: "Resolution:",
    riskPrefix: "Considerations:",
    closingTag: "#buildinpublic #engineering",
  },
  casual: {
    opener: (p) => `So I ran into this: ${p}`,
    solutionPrefix: "Here's what I did:",
    riskPrefix: "One thing to watch:",
    closingTag: "#buildinpublic",
  },
};

function getTone(tone: string): ToneStyle {
  return TONE_STYLES[tone] ?? TONE_STYLES.technical;
}

function filesSummary(diff: DiffResult, maxFiles = 8): string {
  const listed = diff.files
    .slice(0, maxFiles)
    .map((f) => `${f.filename} (+${f.additions}/-${f.deletions})`);
  const remaining = diff.files.length - listed.length;
  if (remaining > 0) {
    listed.push(`...and ${remaining} more file(s)`);
  }
  return listed.join(", ");
}

function renderX(
  narrative: Narrative,
  diff: DiffResult,
  tone: ToneStyle
): Draft {
  const tweet = [
    tone.opener(narrative.problem),
    "",
    `${tone.solutionPrefix} ${narrative.solution}`,
    "",
    tone.closingTag,
  ].join("\n");

  if (tweet.length <= X_CHAR_LIMIT) {
    return { platform: "x", content: tweet };
  }

  const part1 = `${tone.opener(narrative.problem)}\n\n${tone.solutionPrefix} ${narrative.solution}`;
  const part2 = [
    narrative.risk !== "No obvious risks."
      ? `${tone.riskPrefix} ${narrative.risk}`
      : null,
    `Files: ${filesSummary(diff)}`,
    tone.closingTag,
  ]
    .filter(Boolean)
    .join("\n\n");

  const threadParts = [part1, part2];
  return {
    platform: "x",
    content: threadParts.join("\n\n---\n\n"),
    threadParts,
  };
}

function renderLinkedIn(
  narrative: Narrative,
  diff: DiffResult,
  config: BipConfig,
  tone: ToneStyle
): Draft {
  const sections = [
    `🔧 Build Log — ${diff.message}`,
    "",
    `**The Problem**\n${narrative.problem}`,
    "",
    `**What Changed**\n${narrative.solution}`,
    "",
    `**Files touched:** ${filesSummary(diff)}`,
  ];

  if (narrative.risk && narrative.risk !== "No obvious risks.") {
    sections.push("", `**Risks & Tradeoffs**\n${narrative.risk}`);
  }

  if (narrative.testingNotes) {
    sections.push("", `**Testing Notes**\n${narrative.testingNotes}`);
  }

  sections.push(
    "",
    `— ${config.user.name}`,
    "",
    "#BuildInPublic #SoftwareEngineering #DevLog"
  );

  return {
    platform: "linkedin",
    content: sections.join("\n"),
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
        drafts.push(renderX(narrative, diff, tone));
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
