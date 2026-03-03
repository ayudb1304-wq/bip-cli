import http from "node:http";
import { buildPushCommitEvents, parseGitHubPushPayload, verifyGitHubSignature } from "./github.js";
import { enqueueEvents } from "./queue.js";
import { upsertInstallationToken } from "./token-store.js";

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, code: number, payload: unknown): void {
  res.statusCode = code;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

export function startWebhookServer(options?: {
  port?: number;
  host?: string;
  cwd?: string;
}): http.Server {
  const port = options?.port ?? 8787;
  const host = options?.host ?? "0.0.0.0";
  const cwd = options?.cwd ?? process.cwd();
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("GITHUB_WEBHOOK_SECRET must be set before starting webhook server.");
  }

  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/healthz") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method !== "POST" || req.url !== "/webhooks/github") {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    try {
      const rawBody = await readBody(req);
      const signature = req.headers["x-hub-signature-256"];
      const signatureHeader = Array.isArray(signature) ? signature[0] : signature;
      if (!verifyGitHubSignature(rawBody, signatureHeader, webhookSecret)) {
        sendJson(res, 401, { error: "Invalid signature" });
        return;
      }

      const githubEvent = req.headers["x-github-event"];
      const eventType = Array.isArray(githubEvent) ? githubEvent[0] : githubEvent;
      if (eventType !== "push") {
        sendJson(res, 202, { ignored: true, reason: "Only push events are handled." });
        return;
      }

      const payload = parseGitHubPushPayload(JSON.parse(rawBody));
      const deliveryHeader = req.headers["x-github-delivery"];
      const deliveryId = Array.isArray(deliveryHeader) ? deliveryHeader[0] : deliveryHeader;
      const events = buildPushCommitEvents(payload, { deliveryId });

      const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
      const tokenFromEnv = process.env.GITHUB_INSTALLATION_TOKEN;
      const token = bearer || tokenFromEnv;
      if (token) {
        upsertInstallationToken(payload.repository.full_name, token, {
          installationId: payload.installation?.id,
          cwd,
        });
      }

      enqueueEvents(events, cwd);
      sendJson(res, 202, { enqueued: events.length });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  server.listen(port, host);
  return server;
}
