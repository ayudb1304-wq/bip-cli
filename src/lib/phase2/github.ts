import type { EngineEvent, GitHubPushPayload } from "./types.js";

export function parseGitHubPushPayload(raw: unknown): GitHubPushPayload {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("GitHub payload must be an object.");
  }

  const payload = raw as Record<string, unknown>;
  const repository = payload.repository as Record<string, unknown> | undefined;
  const commits = payload.commits as Array<Record<string, unknown>> | undefined;

  if (!repository || typeof repository.full_name !== "string") {
    throw new Error("Invalid GitHub payload: missing repository.full_name.");
  }

  if (!Array.isArray(commits)) {
    throw new Error("Invalid GitHub payload: missing commits array.");
  }

  return {
    ref: String(payload.ref ?? ""),
    repository: {
      full_name: repository.full_name,
      default_branch: String(repository.default_branch ?? "main"),
    },
    commits: commits.map((commit) => ({
      id: String(commit.id ?? ""),
      message: String(commit.message ?? ""),
      timestamp: String(commit.timestamp ?? new Date().toISOString()),
      added: Array.isArray(commit.added) ? commit.added.map(String) : [],
      removed: Array.isArray(commit.removed) ? commit.removed.map(String) : [],
      modified: Array.isArray(commit.modified) ? commit.modified.map(String) : [],
    })),
  };
}

export function buildPushCommitEvents(
  payload: GitHubPushPayload,
  options?: { repoPath?: string }
): EngineEvent[] {
  const branch = payload.ref.replace("refs/heads/", "") || payload.repository.default_branch;

  return payload.commits
    .filter((commit) => commit.id.length > 0)
    .map((commit) => ({
      id: `github:${payload.repository.full_name}:${commit.id}`,
      source: "github" as const,
      kind: "push_commit" as const,
      repoFullName: payload.repository.full_name,
      commitSha: commit.id,
      commitMessage: commit.message,
      branch,
      occurredAt: commit.timestamp,
      repoPath: options?.repoPath,
    }));
}
