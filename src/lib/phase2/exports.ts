import fs from "node:fs";
import path from "node:path";
import { getTimeline, listWorkerOutputs } from "./dashboard.js";

export function exportTimelineMarkdown(cwd = process.cwd()): string {
  const timeline = getTimeline(cwd);
  const lines = ["# BiP Engine Timeline Export", ""];
  for (const item of timeline) {
    lines.push(`- [${item.status}] ${item.repo} ${item.commitSha.slice(0, 8)} (${item.updatedAt})`);
    if (item.assets?.snippetCardUrl) lines.push(`  - snippet: ${item.assets.snippetCardUrl}`);
    if (item.assets?.progressDashboardUrl)
      lines.push(`  - dashboard: ${item.assets.progressDashboardUrl}`);
  }
  return `${lines.join("\n")}\n`;
}

export function exportTypefullyPayload(cwd = process.cwd()): {
  posts: Array<{ content: string; mediaUrls: string[] }>;
} {
  const outputs = listWorkerOutputs(cwd);
  const posts = outputs.map((entry) => {
    const drafts = (entry.parsed as { drafts?: Array<{ platform: string; content: string }> }).drafts ?? [];
    const xDraft = drafts.find((draft) => draft.platform === "x");
    const assets = entry.parsed.assets ?? {};
    return {
      content: xDraft?.content ?? "Build update",
      mediaUrls: [assets.snippetCardUrl, assets.progressDashboardUrl].filter(Boolean) as string[],
    };
  });
  return { posts };
}

export function writeWeeklySummary(cwd = process.cwd()): string {
  const outputs = listWorkerOutputs(cwd);
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekly = outputs.filter((entry) => {
    const stats = fs.statSync(entry.path);
    return stats.mtimeMs >= oneWeekAgo;
  });

  const summaryDir = path.join(cwd, ".bip", "engine", "summaries");
  fs.mkdirSync(summaryDir, { recursive: true });
  const dateStamp = new Date().toISOString().slice(0, 10);
  const outPath = path.join(summaryDir, `weekly-${dateStamp}.md`);
  const lines = [
    `# Weekly Build Summary (${dateStamp})`,
    "",
    `Total processed outputs: ${weekly.length}`,
    "",
  ];

  for (const item of weekly) {
    const parsed = item.parsed as unknown as {
      event: { repoFullName?: string; commitSha: string; commitMessage?: string };
      narrative?: { problem: string; solution: string };
    };
    const repoName = parsed.event.repoFullName ?? "unknown/repo";
    const message = parsed.event.commitMessage ?? "(no commit message)";
    lines.push(
      `- ${repoName} ${parsed.event.commitSha.slice(0, 8)}: ${message}`
    );
    if (parsed.narrative?.solution) {
      lines.push(`  - Outcome: ${parsed.narrative.solution}`);
    }
  }

  fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf-8");
  return outPath;
}
