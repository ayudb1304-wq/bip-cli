export interface GitHubPushPayload {
  ref: string;
  repository: {
    full_name: string;
    default_branch: string;
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
  source: "github";
  kind: "push_commit";
  repoFullName: string;
  commitSha: string;
  commitMessage: string;
  branch: string;
  occurredAt: string;
  repoPath?: string;
}

export interface WorkerResult {
  eventId: string;
  commitSha: string;
  outputPath: string;
}
