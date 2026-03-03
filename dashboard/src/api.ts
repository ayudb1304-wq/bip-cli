import type { DashboardSnapshot } from "./types";

export async function fetchTimeline(): Promise<DashboardSnapshot> {
  const response = await fetch("/api/timeline");
  if (!response.ok) {
    throw new Error(`Timeline request failed (${response.status})`);
  }
  return (await response.json()) as DashboardSnapshot;
}

export async function fetchExport(
  kind: "markdown" | "typefully"
): Promise<{ content: string; filename: string; mimeType: string }> {
  const endpoint = kind === "markdown" ? "/api/export/markdown" : "/api/export/typefully";
  const response = await fetch(endpoint, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Export request failed (${response.status})`);
  }

  if (kind === "markdown") {
    const content = await response.text();
    return {
      content,
      filename: "bip-timeline-export.md",
      mimeType: "text/markdown;charset=utf-8",
    };
  }

  const json = await response.json();
  return {
    content: JSON.stringify(json, null, 2),
    filename: "bip-typefully-export.json",
    mimeType: "application/json;charset=utf-8",
  };
}
