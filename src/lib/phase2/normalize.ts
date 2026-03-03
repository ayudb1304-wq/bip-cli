import type { DiffResult } from "../git-parser.js";

export type NormalizedHunk = {
  header: string;
  addedLines: string[];
  removedLines: string[];
};

export type NormalizedFileDiff = {
  path: string;
  additions: number;
  deletions: number;
  hunks: NormalizedHunk[];
};

export type NormalizedDiff = {
  commitSha: string;
  message: string;
  author: string;
  date: string;
  files: NormalizedFileDiff[];
};

function extractHunks(rawDiff: string): NormalizedHunk[] {
  const lines = rawDiff.split("\n");
  const hunks: NormalizedHunk[] = [];
  let current: NormalizedHunk | null = null;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      if (current) hunks.push(current);
      current = {
        header: line.trim(),
        addedLines: [],
        removedLines: [],
      };
      continue;
    }
    if (!current) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      current.addedLines.push(line.slice(1));
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      current.removedLines.push(line.slice(1));
    }
  }

  if (current) hunks.push(current);
  return hunks;
}

export function normalizeDiff(diff: DiffResult): NormalizedDiff {
  return {
    commitSha: diff.commitSha,
    message: diff.message,
    author: diff.author,
    date: diff.date,
    files: diff.files.map((file) => ({
      path: file.filename,
      additions: file.additions,
      deletions: file.deletions,
      hunks: extractHunks(file.rawDiff),
    })),
  };
}
