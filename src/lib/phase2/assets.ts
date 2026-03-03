import fs from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { NormalizedDiff } from "./normalize.js";

type SnippetSelection = {
  filePath: string;
  snippet: string;
};

export type ProgressMetrics = {
  locAdded: number;
  locDeleted: number;
  filesChanged: number;
};

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function selectSnippetFromDiff(normalized: NormalizedDiff): SnippetSelection | null {
  if (normalized.files.length === 0) return null;
  const target = [...normalized.files].sort(
    (a, b) => b.additions + b.deletions - (a.additions + a.deletions)
  )[0];
  const firstHunk = target.hunks[0];
  if (!firstHunk) return null;

  const lines = [...firstHunk.addedLines.slice(0, 8), ...firstHunk.removedLines.slice(0, 8)]
    .slice(0, 12)
    .join("\n")
    .trim();
  if (!lines) return null;
  return {
    filePath: target.path,
    snippet: lines,
  };
}

export function buildSnippetCardSvg(selection: SnippetSelection): string {
  const body = escapeXml(selection.snippet);
  const title = escapeXml(selection.filePath);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675">
  <rect width="1200" height="675" fill="#111827" />
  <rect x="40" y="40" width="1120" height="595" rx="18" fill="#1f2937" stroke="#374151" />
  <text x="70" y="95" font-size="28" font-family="Menlo,Monaco,monospace" fill="#93c5fd">${title}</text>
  <foreignObject x="70" y="130" width="1060" height="480">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#e5e7eb;font-family:Menlo,Monaco,monospace;font-size:20px;line-height:1.5;white-space:pre-wrap;">
${body}
    </div>
  </foreignObject>
</svg>`;
}

export function buildProgressDashboardSvg(metrics: ProgressMetrics): string {
  const total = Math.max(metrics.locAdded + metrics.locDeleted, 1);
  const addPct = Math.min(100, Math.round((metrics.locAdded / total) * 100));
  const delPct = Math.min(100, Math.round((metrics.locDeleted / total) * 100));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675">
  <rect width="1200" height="675" fill="#0f172a" />
  <text x="60" y="90" font-size="42" font-family="Inter,Arial,sans-serif" fill="#e2e8f0">Weekly Build Progress</text>
  <text x="60" y="150" font-size="30" font-family="Inter,Arial,sans-serif" fill="#93c5fd">Files Changed: ${metrics.filesChanged}</text>
  <rect x="60" y="220" width="1080" height="56" rx="12" fill="#1e293b" />
  <rect x="60" y="220" width="${Math.round((1080 * addPct) / 100)}" height="56" rx="12" fill="#22c55e" />
  <text x="60" y="315" font-size="26" font-family="Inter,Arial,sans-serif" fill="#86efac">LOC Added: ${metrics.locAdded} (${addPct}%)</text>
  <rect x="60" y="380" width="1080" height="56" rx="12" fill="#1e293b" />
  <rect x="60" y="380" width="${Math.round((1080 * delPct) / 100)}" height="56" rx="12" fill="#f87171" />
  <text x="60" y="475" font-size="26" font-family="Inter,Arial,sans-serif" fill="#fca5a5">LOC Deleted: ${metrics.locDeleted} (${delPct}%)</text>
</svg>`;
}

async function tryRenderPngFromSvg(svg: string, outputPath: string): Promise<boolean> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 675 } });
    await page.setContent(svg);
    await page.screenshot({ path: outputPath });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

async function uploadToS3IfConfigured(localPath: string, key: string): Promise<string | null> {
  const bucket = process.env.BIP_ASSET_BUCKET;
  const region = process.env.AWS_REGION;
  if (!bucket || !region) return null;

  const client = new S3Client({ region });
  const body = fs.readFileSync(localPath);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: key.endsWith(".png") ? "image/png" : "image/svg+xml",
    })
  );
  const cdnBase = process.env.BIP_ASSET_CDN_BASE_URL;
  if (cdnBase) return `${cdnBase.replace(/\/$/, "")}/${key}`;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function persistAsset(
  content: string,
  outputName: string,
  options?: { cwd?: string; preferPng?: boolean }
): Promise<string> {
  const cwd = options?.cwd ?? process.cwd();
  const assetsDir = path.join(cwd, ".bip", "engine", "assets");
  fs.mkdirSync(assetsDir, { recursive: true });

  const svgPath = path.join(assetsDir, `${outputName}.svg`);
  fs.writeFileSync(svgPath, content, "utf-8");

  let localPath = svgPath;
  if (options?.preferPng) {
    const pngPath = path.join(assetsDir, `${outputName}.png`);
    const rendered = await tryRenderPngFromSvg(content, pngPath);
    if (rendered) {
      localPath = pngPath;
    }
  }

  const key = `engine-assets/${path.basename(localPath)}`;
  const remoteUrl = await uploadToS3IfConfigured(localPath, key);
  if (remoteUrl) return remoteUrl;
  return localPath;
}
