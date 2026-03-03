import fs from "node:fs";
import path from "node:path";
import type { QueueRecord } from "./types.js";
import { readQueueRecords, queueStats } from "./queue.js";

export type DashboardTimelineItem = {
  id: string;
  commitSha: string;
  repo: string;
  status: "pending" | "processing" | "processed" | "failed";
  occurredAt: string;
  updatedAt: string;
  retries: number;
  outputPath?: string;
  assets?: {
    snippetCardUrl?: string;
    progressDashboardUrl?: string;
  };
  drafts?: {
    x?: string;
    linkedin?: string;
  };
};

type WorkerOutput = {
  event: {
    id: string;
    commitSha: string;
  };
  drafts?: Array<{
    platform: string;
    content: string;
  }>;
  assets?: {
    snippetCardUrl?: string;
    progressDashboardUrl?: string;
  };
};

function toAssetHref(assetUrl: string | undefined): string | undefined {
  if (!assetUrl) return undefined;
  if (/^https?:\/\//.test(assetUrl)) return assetUrl;
  if (assetUrl.startsWith("/api/assets?path=")) return assetUrl;
  // Local file system paths are exposed through dashboard API route.
  if (path.isAbsolute(assetUrl)) {
    return `/api/assets?path=${encodeURIComponent(assetUrl)}`;
  }
  return assetUrl;
}

function getOutputsDir(cwd = process.cwd()): string {
  return path.join(cwd, ".bip", "engine", "outputs");
}

function extractDrafts(
  drafts: Array<{ platform: string; content: string }> | undefined
): DashboardTimelineItem["drafts"] {
  if (!drafts || drafts.length === 0) return {};
  return {
    x: drafts.find((draft) => draft.platform === "x")?.content,
    linkedin: drafts.find((draft) => draft.platform === "linkedin")?.content,
  };
}

export function listWorkerOutputs(cwd = process.cwd()): Array<{ path: string; parsed: WorkerOutput }> {
  const dir = getOutputsDir(cwd);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const absolute = path.join(dir, name);
      const parsed = JSON.parse(fs.readFileSync(absolute, "utf-8")) as WorkerOutput;
      return { path: absolute, parsed };
    });
}

function toTimelineItem(
  record: QueueRecord,
  status: DashboardTimelineItem["status"],
  outputsByEventId: Map<string, { path: string; parsed: WorkerOutput }>
): DashboardTimelineItem {
  const output = outputsByEventId.get(record.event.id);
  return {
    id: record.event.id,
    commitSha: record.event.commitSha,
    repo: record.event.repoFullName,
    status,
    occurredAt: record.event.occurredAt,
    updatedAt: record.updatedAt,
    retries: record.attempts,
    outputPath: output?.path,
    assets: {
      snippetCardUrl: toAssetHref(output?.parsed.assets?.snippetCardUrl),
      progressDashboardUrl: toAssetHref(output?.parsed.assets?.progressDashboardUrl),
    },
    drafts: extractDrafts(output?.parsed.drafts),
  };
}

export function getTimeline(cwd = process.cwd()): DashboardTimelineItem[] {
  const outputs = listWorkerOutputs(cwd);
  const outputsByEventId = new Map(outputs.map((item) => [item.parsed.event.id, item]));

  const pending = readQueueRecords("pending", cwd).map((record) =>
    toTimelineItem(record, "pending", outputsByEventId)
  );
  const processing = readQueueRecords("processing", cwd).map((record) =>
    toTimelineItem(record, "processing", outputsByEventId)
  );
  const processed = readQueueRecords("processed", cwd).map((record) =>
    toTimelineItem(record, "processed", outputsByEventId)
  );
  const failed = readQueueRecords("dlq", cwd).map((record) =>
    toTimelineItem(record, "failed", outputsByEventId)
  );

  return [...processing, ...pending, ...processed, ...failed].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

export function getDashboardSnapshot(cwd = process.cwd()): {
  stats: ReturnType<typeof queueStats>;
  timeline: DashboardTimelineItem[];
} {
  return {
    stats: queueStats(cwd),
    timeline: getTimeline(cwd),
  };
}
