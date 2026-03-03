import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildPushCommitEvents, parseGitHubPushPayload } from "../lib/phase2/github.js";
import { dequeueEvent, enqueueEvents, readQueue } from "../lib/phase2/queue.js";

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

  it("enqueues and dequeues events in FIFO order", () => {
    enqueueEvents(
      [
        {
          id: "event-1",
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
    const first = dequeueEvent(tmpDir);
    const second = dequeueEvent(tmpDir);
    const none = dequeueEvent(tmpDir);

    expect(first?.id).toBe("event-1");
    expect(second?.id).toBe("event-2");
    expect(none).toBeNull();
  });
});
