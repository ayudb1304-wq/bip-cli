import { simpleGit, type SimpleGit } from "simple-git";

export interface FileDiff {
  filename: string;
  additions: number;
  deletions: number;
  rawDiff: string;
}

export interface DiffResult {
  commitSha: string;
  message: string;
  author: string;
  date: string;
  files: FileDiff[];
}

const DIFF_HEADER_RE = /^diff --git a\/(.+?) b\/(.+)$/m;

export function parseRawPatch(rawPatch: string): FileDiff[] {
  const files: FileDiff[] = [];
  const segments = rawPatch.split(/(?=^diff --git )/m);

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const headerMatch = trimmed.match(DIFF_HEADER_RE);
    if (!headerMatch) continue;

    const filename = headerMatch[2];
    let additions = 0;
    let deletions = 0;

    const lines = trimmed.split("\n");
    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) additions++;
      if (line.startsWith("-") && !line.startsWith("---")) deletions++;
    }

    files.push({ filename, additions, deletions, rawDiff: trimmed });
  }

  return files;
}

/**
 * Extract a structured diff for a given commit SHA.
 * @param commitSha - The full or short SHA of the commit.
 * @param repoPath  - Path to the git repository (defaults to cwd).
 */
export async function parseDiff(
  commitSha: string,
  repoPath?: string
): Promise<DiffResult> {
  const git: SimpleGit = simpleGit(repoPath ?? process.cwd());

  const log = await git.log({ from: commitSha, to: commitSha, maxCount: 1 });

  if (!log.latest) {
    throw new Error(`Commit ${commitSha} not found in repository.`);
  }

  const { hash, message, author_name, date } = log.latest;

  const rawPatch = await git.show([hash, "--format="]);

  const files = parseRawPatch(rawPatch);

  return {
    commitSha: hash,
    message,
    author: author_name,
    date,
    files,
  };
}
