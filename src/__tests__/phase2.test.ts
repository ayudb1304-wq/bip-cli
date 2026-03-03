import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildPushCommitEvents,
  parseGitHubPushPayload,
  verifyGitHubSignature,
} from "../lib/phase2/github.js";
import {
  ackEvent,
  claimNextEvent,
  enqueueEvents,
  nackEvent,
  queueStats,
  readQueue,
  readQueueRecords,
} from "../lib/phase2/queue.js";

describe("phase2 github ingestion", () => {
  it("parses push payload and builds commit events", () => {
    const payload = parseGitHubPushPayload({
      ref: "refs/heads/main",
      repository: {
        full_name: "ayudb1304-wq/bip-cli",
        default_branch: "main",
      },
      commits: [
        {
          id: "abc123456789",
          message: "feat: add worker scaffolding",
          timestamp: "2026-03-03T00:00:00.000Z",
        },
      ],
    });

    const events = buildPushCommitEvents(payload, { repoPath: "/tmp/repo" });
    expect(events).toHaveLength(1);
    expect(events[0].commitSha).toBe("abc123456789");
    expect(events[0].repoFullName).toBe("ayudb1304-wq/bip-cli");
    expect(events[0].repoPath).toBe("/tmp/repo");
    expect(events[0].idempotencyKey).toContain("github:");
  });

  it("validates GitHub webhook signatures", () => {
    const body = JSON.stringify({ hello: "world" });
    const secret = "test-secret";
    const signature = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyGitHubSignature(body, signature, secret)).toBe(true);
    expect(verifyGitHubSignature(body, "sha256=bad", secret)).toBe(false);
  });
});

describe("phase2 queue", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bip-queue-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("enqueues and claims events in FIFO order", () => {
    enqueueEvents(
      [
        {
          id: "event-1",
          idempotencyKey: "event-1",
          source: "github",
          kind: "push_commit",
          repoFullName: "owner/repo",
          commitSha: "11111111",
          commitMessage: "first",
          branch: "main",
          occurredAt: "2026-03-03T00:00:00.000Z",
        },
        {
          id: "event-2",
          idempotencyKey: "event-2",
          source: "github",
          kind: "push_commit",
          repoFullName: "owner/repo",
          commitSha: "22222222",
          commitMessage: "second",
          branch: "main",
          occurredAt: "2026-03-03T00:01:00.000Z",
        },
      ],
      tmpDir
    );

    expect(readQueue(tmpDir)).toHaveLength(2);
    const first = claimNextEvent(tmpDir);
    const second = claimNextEvent(tmpDir);
    const none = claimNextEvent(tmpDir);

    expect(first?.event.id).toBe("event-1");
    expect(second?.event.id).toBe("event-2");
    expect(none).toBeNull();
  });

  it("deduplicates events by idempotency key", () => {
    const shared = {
      source: "github" as const,
      kind: "push_commit" as const,
      repoFullName: "owner/repo",
      commitSha: "11111111",
      commitMessage: "first",
      branch: "main",
      occurredAt: "2026-03-03T00:00:00.000Z",
    };

    enqueueEvents(
      [
        { ...shared, id: "event-1", idempotencyKey: "same-key" },
        { ...shared, id: "event-2", idempotencyKey: "same-key" },
      ],
      tmpDir
    );
    expect(readQueue(tmpDir)).toHaveLength(1);
  });

  it("moves exhausted retries to DLQ", () => {
    enqueueEvents(
      [
        {
          id: "event-1",
          idempotencyKey: "event-1",
          source: "github",
          kind: "push_commit",
          repoFullName: "owner/repo",
          commitSha: "11111111",
          commitMessage: "first",
          branch: "main",
          occurredAt: "2026-03-03T00:00:00.000Z",
          maxRetries: 0,
        },
      ],
      tmpDir
    );

    const record = claimNextEvent(tmpDir);
    expect(record).toBeTruthy();
    nackEvent(record!, new Error("boom"), tmpDir, 1);
    const stats = queueStats(tmpDir);
    expect(stats.dlq).toBe(1);
  });

  it("acks successful processing", () => {
    enqueueEvents(
      [
        {
          id: "event-1",
          idempotencyKey: "event-1",
          source: "github",
          kind: "push_commit",
          repoFullName: "owner/repo",
          commitSha: "11111111",
          commitMessage: "first",
          branch: "main",
          occurredAt: "2026-03-03T00:00:00.000Z",
        },
      ],
      tmpDir
    );

    const record = claimNextEvent(tmpDir);
    expect(record).toBeTruthy();
    ackEvent(record!, tmpDir);
    const processed = readQueueRecords("processed", tmpDir);
    expect(processed).toHaveLength(1);
  });
});
