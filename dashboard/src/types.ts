export type TimelineStatus = "pending" | "processing" | "processed" | "failed";

export type TimelineItem = {
  id: string;
  commitSha: string;
  repo: string;
  status: TimelineStatus;
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

export type DashboardSnapshot = {
  stats: {
    pending: number;
    processing: number;
    processed: number;
    dlq: number;
  };
  timeline: TimelineItem[];
};
