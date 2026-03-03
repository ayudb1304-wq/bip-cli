import http from "node:http";
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

const frontendHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BiP Dashboard</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
      .container { max-width: 980px; margin: 24px auto; padding: 0 16px; }
      .card { background: #1e293b; border-radius: 12px; padding: 14px; margin-bottom: 12px; }
      .meta { color: #94a3b8; font-size: 13px; }
      button { margin-right: 8px; padding: 8px 10px; border-radius: 8px; border: 0; cursor: pointer; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
      const e = React.createElement;
      function App() {
        const [snapshot, setSnapshot] = React.useState(null);
        const [loading, setLoading] = React.useState(true);
        React.useEffect(() => {
          fetch('/api/timeline').then(r => r.json()).then(data => { setSnapshot(data); setLoading(false); });
        }, []);
        if (loading) return e('div', { className: 'container' }, 'Loading...');
        return e('div', { className: 'container' },
          e('h1', null, 'BiP Timeline'),
          e('div', { className: 'meta' }, 'pending: ' + snapshot.stats.pending + ' | processing: ' + snapshot.stats.processing + ' | processed: ' + snapshot.stats.processed + ' | dlq: ' + snapshot.stats.dlq),
          e('div', { style: { margin: '16px 0' } },
            e('button', { onClick: async () => { const res = await fetch('/api/export/markdown', { method: 'POST' }); const text = await res.text(); alert(text.slice(0, 280)); } }, 'Export Markdown'),
            e('button', { onClick: async () => { const res = await fetch('/api/export/typefully', { method: 'POST' }); const text = await res.text(); alert(text.slice(0, 280)); } }, 'Export Typefully JSON')
          ),
          ...snapshot.timeline.map((item) =>
            e('div', { className: 'card', key: item.id },
              e('div', null, item.repo + ' ' + item.commitSha.slice(0, 8)),
              e('div', { className: 'meta' }, item.status + ' | retries: ' + item.retries + ' | ' + item.updatedAt),
              item.assets && item.assets.snippetCardUrl ? e('a', { href: item.assets.snippetCardUrl, target: '_blank' }, 'Snippet asset') : null,
              item.assets && item.assets.progressDashboardUrl ? e('div', null, e('a', { href: item.assets.progressDashboardUrl, target: '_blank' }, 'Progress asset')) : null
            )
          )
        );
      }
      ReactDOM.createRoot(document.getElementById('root')).render(e(App));
    </script>
  </body>
</html>`;

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

    if (req.method === "GET" && req.url === "/healthz") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && req.url === "/api/timeline") {
      sendJson(res, 200, getDashboardSnapshot(cwd));
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

    if (req.method === "GET" && req.url === "/") {
      sendText(res, 200, frontendHtml, "text/html; charset=utf-8");
      return;
    }

    sendJson(res, 404, { error: "not found" });
  });

  server.listen(port, host);
  return server;
}
