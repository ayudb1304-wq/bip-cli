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

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".ts" || ext === ".tsx") return "TypeScript";
  if (ext === ".js" || ext === ".jsx") return "JavaScript";
  if (ext === ".py") return "Python";
  if (ext === ".go") return "Go";
  if (ext === ".java") return "Java";
  if (ext === ".rs") return "Rust";
  if (ext === ".json") return "JSON";
  return ext ? ext.slice(1).toUpperCase() : "Code";
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
  const lines = selection.snippet
    .split("\n")
    .map((line, index) => `<tspan x="102" dy="${index === 0 ? 0 : 32}">${escapeXml(line)}</tspan>`)
    .join("");
  const title = escapeXml(selection.filePath);
  const language = detectLanguage(selection.filePath);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675">
  <defs>
    <linearGradient id="bgA" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#102234" />
      <stop offset="50%" stop-color="#15354A" />
      <stop offset="100%" stop-color="#0D1A28" />
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#44A194" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#537D96" stop-opacity="0.95" />
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#bgA)" />
  <rect x="48" y="48" width="1104" height="579" rx="26" fill="#0D2234" stroke="#2B4D63" />
  <rect x="48" y="48" width="1104" height="8" rx="26" fill="url(#glow)" />

  <rect x="84" y="96" width="1032" height="58" rx="14" fill="#0F2A3D" stroke="#2A4A61" />
  <circle cx="114" cy="125" r="8" fill="#EC8F8D" />
  <circle cx="142" cy="125" r="8" fill="#F4F0E4" />
  <circle cx="170" cy="125" r="8" fill="#44A194" />
  <text x="200" y="133" font-size="24" font-family="'Syne','Space Grotesk',sans-serif" fill="#F4F0E4">${title}</text>
  <text x="1030" y="133" font-size="18" font-family="'Space Grotesk',sans-serif" fill="#9BC3D5">${language}</text>

  <rect x="84" y="180" width="1032" height="402" rx="18" fill="#0A1824" stroke="#244257" />
  <rect x="84" y="180" width="6" height="402" rx="6" fill="#44A194" />
  <text x="102" y="238" font-size="27" font-family="'JetBrains Mono',ui-monospace,monospace" fill="#EAF6FF">
${lines}
  </text>

  <text x="84" y="620" font-size="18" font-family="'Space Grotesk',sans-serif" fill="#8FB5C8">BiP Snippet • Human-reviewed draft asset</text>
</svg>`;
}

export function buildProgressDashboardSvg(metrics: ProgressMetrics): string {
  const total = Math.max(metrics.locAdded + metrics.locDeleted, 1);
  const addPct = Math.min(100, Math.round((metrics.locAdded / total) * 100));
  const delPct = Math.min(100, Math.round((metrics.locDeleted / total) * 100));
  const trendA = Math.max(10, 460 - Math.round(addPct * 2.4));
  const trendB = Math.max(10, 460 - Math.round(delPct * 2.4));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675">
  <defs>
    <linearGradient id="dashBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A1724" />
      <stop offset="100%" stop-color="#050E17" />
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#dashBg)" />
  <rect x="44" y="44" width="1112" height="587" rx="24" fill="#081725" stroke="#234257" />

  <text x="84" y="118" font-size="58" font-family="'Syne','Space Grotesk',sans-serif" fill="#F4F0E4">Build Progress</text>
  <text x="84" y="154" font-size="24" font-family="'Space Grotesk',sans-serif" fill="#9FC0D1">Last 7 Days</text>

  <rect x="84" y="182" width="1032" height="220" rx="16" fill="#0D2233" stroke="#21465D" />
  <polyline fill="none" stroke="#44A194" stroke-width="5" points="120,${trendA + 40} 280,${trendA} 440,${trendA + 18} 600,${trendA - 16} 760,${trendA + 26} 920,${trendA + 8} 1080,${trendA + 22}" />
  <polyline fill="none" stroke="#EC8F8D" stroke-width="5" points="120,${trendB + 46} 280,${trendB + 10} 440,${trendB + 26} 600,${trendB + 6} 760,${trendB + 34} 920,${trendB + 16} 1080,${trendB + 24}" />
  <line x1="84" y1="366" x2="1116" y2="366" stroke="#274960" stroke-width="2" />

  <rect x="84" y="430" width="318" height="158" rx="16" fill="#0F2436" stroke="#2A4E66" />
  <text x="108" y="470" font-size="22" font-family="'Space Grotesk',sans-serif" fill="#A7C3D2">Files Changed</text>
  <text x="108" y="540" font-size="62" font-family="'Syne','Space Grotesk',sans-serif" fill="#F4F0E4">${metrics.filesChanged}</text>

  <rect x="441" y="430" width="318" height="158" rx="16" fill="#0F2436" stroke="#2A4E66" />
  <text x="465" y="470" font-size="22" font-family="'Space Grotesk',sans-serif" fill="#A7C3D2">LOC Added</text>
  <text x="465" y="540" font-size="62" font-family="'Syne','Space Grotesk',sans-serif" fill="#44A194">${metrics.locAdded}</text>
  <text x="465" y="572" font-size="22" font-family="'Space Grotesk',sans-serif" fill="#9BC2D3">${addPct}% of change volume</text>

  <rect x="798" y="430" width="318" height="158" rx="16" fill="#0F2436" stroke="#2A4E66" />
  <text x="822" y="470" font-size="22" font-family="'Space Grotesk',sans-serif" fill="#A7C3D2">LOC Deleted</text>
  <text x="822" y="540" font-size="62" font-family="'Syne','Space Grotesk',sans-serif" fill="#EC8F8D">${metrics.locDeleted}</text>
  <text x="822" y="572" font-size="22" font-family="'Space Grotesk',sans-serif" fill="#9BC2D3">${delPct}% of change volume</text>
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
