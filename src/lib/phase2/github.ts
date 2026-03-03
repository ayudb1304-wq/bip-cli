import crypto from "node:crypto";
import https from "node:https";
import type { DiffResult } from "../git-parser.js";
import { parseRawPatch } from "../git-parser.js";
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
    before: typeof payload.before === "string" ? payload.before : undefined,
    after: typeof payload.after === "string" ? payload.after : undefined,
    repository: {
      full_name: repository.full_name,
      default_branch: String(repository.default_branch ?? "main"),
    },
    installation:
      payload.installation &&
      typeof (payload.installation as Record<string, unknown>).id === "number"
        ? { id: (payload.installation as Record<string, number>).id }
        : undefined,
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
  options?: { repoPath?: string; deliveryId?: string; maxRetries?: number }
): EngineEvent[] {
  const branch = payload.ref.replace("refs/heads/", "") || payload.repository.default_branch;

  return payload.commits
    .filter((commit) => commit.id.length > 0)
    .map((commit) => ({
      id: `github:${payload.repository.full_name}:${commit.id}`,
      idempotencyKey: `github:${payload.repository.full_name}:${commit.id}`,
      source: "github" as const,
      kind: "push_commit" as const,
      repoFullName: payload.repository.full_name,
      commitSha: commit.id,
      commitMessage: commit.message,
      branch,
      occurredAt: commit.timestamp,
      repoPath: options?.repoPath,
      installationId: payload.installation?.id,
      deliveryId: options?.deliveryId,
      retryCount: 0,
      maxRetries: options?.maxRetries ?? 3,
    }));
}

export function verifyGitHubSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(signatureHeader, "utf-8");
  const b = Buffer.from(expected, "utf-8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

type GitHubCommitApiResponse = {
  sha: string;
  commit: {
    message: string;
    author?: {
      name?: string;
      date?: string;
    };
  };
  files?: Array<{
    filename: string;
    patch?: string;
    additions: number;
    deletions: number;
  }>;
};

function apiGet<T>(url: string, token: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "sushi-phase2-worker",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          if ((res.statusCode ?? 500) >= 400) {
            reject(
              new Error(`GitHub API request failed (${res.statusCode ?? "unknown"}): ${body}`)
            );
            return;
          }
          try {
            resolve(JSON.parse(body) as T);
          } catch (error) {
            reject(new Error(`Failed to parse GitHub API response: ${String(error)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

export async function fetchCommitDiffFromGitHub(
  repoFullName: string,
  commitSha: string,
  token: string
): Promise<DiffResult> {
  const url = `https://api.github.com/repos/${repoFullName}/commits/${commitSha}`;
  const response = await apiGet<GitHubCommitApiResponse>(url, token);
  const files = (response.files ?? []).map((file) => {
    const rawDiff = file.patch
      ? `diff --git a/${file.filename} b/${file.filename}\n--- a/${file.filename}\n+++ b/${file.filename}\n${file.patch}`
      : `diff --git a/${file.filename} b/${file.filename}`;
    const parsed = parseRawPatch(rawDiff);
    if (parsed.length > 0) {
      return parsed[0];
    }
    return {
      filename: file.filename,
      additions: file.additions,
      deletions: file.deletions,
      rawDiff,
    };
  });

  return {
    commitSha: response.sha,
    message: response.commit.message,
    author: response.commit.author?.name ?? "unknown",
    date: response.commit.author?.date ?? new Date().toISOString(),
    files,
  };
}
