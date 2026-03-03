import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { getDashboardSnapshot } from "./dashboard.js";
import { exportTimelineMarkdown, exportTypefullyPayload } from "./exports.js";

function sendJson(res: http.ServerResponse, code: number, payload: unknown): void {
  res.statusCode = code;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

function sendText(res: http.ServerResponse, code: number, content: string, contentType: string): void {
  res.statusCode = code;
  res.setHeader("content-type", contentType);
  res.end(content);
}

function guessMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".woff2") return "font/woff2";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function getDashboardDistDir(cwd = process.cwd()): string {
  return path.join(cwd, "dashboard", "dist");
}

function serveFile(res: http.ServerResponse, filePath: string): void {
  res.statusCode = 200;
  res.setHeader("content-type", guessMime(filePath));
  fs.createReadStream(filePath).pipe(res);
}

function tryServeDashboardAsset(
  reqPath: string,
  cwd: string,
  res: http.ServerResponse
): boolean {
  const distDir = getDashboardDistDir(cwd);
  if (!fs.existsSync(distDir)) return false;

  const normalized = reqPath === "/" ? "/index.html" : reqPath;
  const resolved = path.resolve(path.join(distDir, normalized.replace(/^\/+/, "")));

  if (!resolved.startsWith(path.resolve(distDir))) return false;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return false;

  serveFile(res, resolved);
  return true;
}

export function startDashboardServer(options?: {
  port?: number;
  host?: string;
  cwd?: string;
}): http.Server {
  const port = options?.port ?? 8788;
  const host = options?.host ?? "0.0.0.0";
  const cwd = options?.cwd ?? process.cwd();

  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      sendJson(res, 400, { error: "missing url" });
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "GET" && req.url === "/healthz") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && req.url === "/api/timeline") {
      sendJson(res, 200, getDashboardSnapshot(cwd));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/assets") {
      const rawPath = url.searchParams.get("path");
      if (!rawPath) {
        sendJson(res, 400, { error: "missing path query parameter" });
        return;
      }
      const resolved = path.resolve(rawPath);
      const allowedRoot = path.resolve(path.join(cwd, ".bip", "engine", "assets"));
      if (!resolved.startsWith(allowedRoot)) {
        sendJson(res, 403, { error: "asset path is outside allowed directory" });
        return;
      }
      if (!fs.existsSync(resolved)) {
        sendJson(res, 404, { error: "asset not found" });
        return;
      }
      res.statusCode = 200;
      res.setHeader("content-type", guessMime(resolved));
      fs.createReadStream(resolved).pipe(res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/export/markdown") {
      sendText(res, 200, exportTimelineMarkdown(cwd), "text/markdown; charset=utf-8");
      return;
    }

    if (req.method === "POST" && req.url === "/api/export/typefully") {
      sendJson(res, 200, exportTypefullyPayload(cwd));
      return;
    }

    if (req.method === "GET") {
      if (tryServeDashboardAsset(url.pathname, cwd, res)) {
        return;
      }
      if (!url.pathname.startsWith("/api/")) {
        const indexPath = path.join(getDashboardDistDir(cwd), "index.html");
        if (fs.existsSync(indexPath)) {
          serveFile(res, indexPath);
          return;
        }
        sendText(
          res,
          503,
          "Dashboard frontend is not built yet. Run `npm run dashboard:build`.",
          "text/plain; charset=utf-8"
        );
        return;
      }
    }

    sendJson(res, 404, { error: "not found" });
  });

  server.listen(port, host);
  return server;
}
