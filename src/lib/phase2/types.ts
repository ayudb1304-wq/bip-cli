export interface GitHubPushPayload {
  ref: string;
  after?: string;
  before?: string;
  repository: {
    full_name: string;
    default_branch: string;
  };
  installation?: {
    id: number;
  };
  commits: Array<{
    id: string;
    message: string;
    timestamp: string;
    added?: string[];
    removed?: string[];
    modified?: string[];
  }>;
}

export interface EngineEvent {
  id: string;
  idempotencyKey: string;
  source: "github";
  kind: "push_commit";
  repoFullName: string;
  commitSha: string;
  commitMessage: string;
  branch: string;
  occurredAt: string;
  repoPath?: string;
  installationId?: number;
  deliveryId?: string;
  retryCount?: number;
  maxRetries?: number;
  lastError?: string;
}

export interface WorkerResult {
  eventId: string;
  commitSha: string;
  outputPath: string;
  assets?: {
    snippetCardUrl?: string;
    progressDashboardUrl?: string;
  };
}

export interface QueueRecord {
  event: EngineEvent;
  status: "pending" | "processing" | "processed" | "failed";
  attempts: number;
  enqueuedAt: string;
  updatedAt: string;
  availableAt: string;
  lastError?: string;
}
