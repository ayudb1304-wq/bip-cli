import { useEffect, useMemo, useState } from "react";
import { fetchExport, fetchTimeline } from "./api";
import type { DashboardSnapshot, TimelineItem, TimelineStatus } from "./types";

type ExportState = {
  open: boolean;
  title: string;
  content: string;
  filename: string;
  mimeType: string;
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function statusLabel(status: TimelineStatus): string {
  return status;
}

function downloadText(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [exportState, setExportState] = useState<ExportState>({
    open: false,
    title: "",
    content: "",
    filename: "",
    mimeType: "text/plain;charset=utf-8",
  });

  const refresh = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTimeline();
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const timeline: TimelineItem[] = snapshot?.timeline ?? [];
  const lastUpdated = useMemo(() => {
    if (!timeline[0]) return "No events yet";
    return formatTimestamp(timeline[0].updatedAt);
  }, [timeline]);

  const onExport = async (kind: "markdown" | "typefully"): Promise<void> => {
    try {
      const payload = await fetchExport(kind);
      setExportState({
        open: true,
        title: kind === "markdown" ? "Markdown export" : "Typefully JSON export",
        content: payload.content,
        filename: payload.filename,
        mimeType: payload.mimeType,
      });
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Export failed");
    }
  };

  const copyDraft = async (content: string | undefined, label: "X" | "LinkedIn"): Promise<void> => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setToast(`Copied ${label} post`);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Build In Public</p>
          <h1>Operational Dashboard</h1>
          <p className="subtle">State-of-the-art event timeline for webhook-driven content generation.</p>
        </div>
        <div className="header-actions">
          <button className="btn ghost" onClick={() => refresh()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="btn solid" onClick={() => onExport("markdown")}>
            Export Markdown
          </button>
          <button className="btn solid alt" onClick={() => onExport("typefully")}>
            Export Typefully JSON
          </button>
        </div>
      </header>

      <main className="content-grid">
        <section className="stat-panel">
          <h2>Pipeline Health</h2>
          <div className="stat-grid">
            <article>
              <p>Pending</p>
              <strong>{snapshot?.stats.pending ?? 0}</strong>
            </article>
            <article>
              <p>Processing</p>
              <strong>{snapshot?.stats.processing ?? 0}</strong>
            </article>
            <article>
              <p>Processed</p>
              <strong>{snapshot?.stats.processed ?? 0}</strong>
            </article>
            <article>
              <p>DLQ</p>
              <strong>{snapshot?.stats.dlq ?? 0}</strong>
            </article>
          </div>
        </section>

        <section className="timeline-panel">
          <div className="timeline-head">
            <h2>Event Timeline</h2>
            <span>Last updated: {lastUpdated}</span>
          </div>

          {loading && <div className="state-box">Loading timeline...</div>}
          {!loading && error && <div className="state-box error">Failed to load timeline: {error}</div>}
          {!loading && !error && timeline.length === 0 && (
            <div className="state-box">No events yet. Push a commit to generate your first timeline entry.</div>
          )}

          {!loading &&
            !error &&
            timeline.map((item) => (
              <article className="timeline-card" key={item.id}>
                <div className="timeline-card-head">
                  <div>
                    <h3>{item.repo}</h3>
                    <p className="sha">{item.commitSha.slice(0, 8)}</p>
                  </div>
                  <span className={`status-pill ${statusLabel(item.status)}`}>{statusLabel(item.status)}</span>
                </div>

                <p className="meta">
                  Retries: {item.retries} • Occurred: {formatTimestamp(item.occurredAt)} • Updated:{" "}
                  {formatTimestamp(item.updatedAt)}
                </p>

                <div className="asset-row">
                  {item.assets?.snippetCardUrl ? (
                    <a href={item.assets.snippetCardUrl} target="_blank" rel="noreferrer" className="asset-link">
                      Open snippet asset
                    </a>
                  ) : (
                    <span className="asset-placeholder">No snippet asset</span>
                  )}
                  {item.assets?.progressDashboardUrl ? (
                    <a
                      href={item.assets.progressDashboardUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="asset-link"
                    >
                      Open progress asset
                    </a>
                  ) : (
                    <span className="asset-placeholder">No progress asset</span>
                  )}
                </div>

                <div className="post-actions">
                  <button
                    className="btn ghost"
                    disabled={!item.drafts?.x}
                    onClick={() => copyDraft(item.drafts?.x, "X")}
                  >
                    Copy X Post
                  </button>
                  <button
                    className="btn ghost"
                    disabled={!item.drafts?.linkedin}
                    onClick={() => copyDraft(item.drafts?.linkedin, "LinkedIn")}
                  >
                    Copy LinkedIn Post
                  </button>
                </div>
              </article>
            ))}
        </section>
      </main>

      <footer className="app-footer">
        <p>BiP Dashboard • Human-in-the-loop content pipeline</p>
        <p>Palette: #F4F0E4 #44A194 #537D96 #EC8F8D</p>
      </footer>

      {exportState.open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>{exportState.title}</h3>
            <pre>{exportState.content}</pre>
            <div className="modal-actions">
              <button
                className="btn ghost"
                onClick={async () => {
                  await navigator.clipboard.writeText(exportState.content);
                  setToast("Copied to clipboard");
                }}
              >
                Copy
              </button>
              <button
                className="btn solid"
                onClick={() =>
                  downloadText(exportState.content, exportState.filename, exportState.mimeType)
                }
              >
                Download
              </button>
              <button
                className="btn ghost"
                onClick={() => setExportState((current) => ({ ...current, open: false }))}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
