import fs from "node:fs";
import path from "node:path";
import type { LlmTelemetry } from "./llm.js";

type MonitoringEvent = {
  timestamp: string;
  type: "generation_telemetry" | "command_error";
  command: string;
  commitSha?: string;
  telemetry?: LlmTelemetry;
  error?: {
    message: string;
    stack?: string;
  };
};

function getTelemetryLogPath(cwd = process.cwd()): string {
  return path.join(cwd, ".bip", "telemetry", "events.jsonl");
}

function appendMonitoringEvent(event: MonitoringEvent, cwd = process.cwd()): void {
  const filePath = getTelemetryLogPath(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, "utf-8");
}

export function logGenerationTelemetry(
  command: string,
  commitSha: string,
  telemetry: LlmTelemetry,
  cwd = process.cwd()
): void {
  appendMonitoringEvent(
    {
      timestamp: new Date().toISOString(),
      type: "generation_telemetry",
      command,
      commitSha,
      telemetry,
    },
    cwd
  );
}

export function reportCommandError(
  command: string,
  error: unknown,
  cwd = process.cwd()
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  appendMonitoringEvent(
    {
      timestamp: new Date().toISOString(),
      type: "command_error",
      command,
      error: {
        message: err.message,
        stack: err.stack,
      },
    },
    cwd
  );
}
