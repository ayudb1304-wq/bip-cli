# BiP MVP Implementation Tracker

> Build-in-Public Content Engine -- transforms Git diffs into platform-specific social media drafts.

**Stack:** Node.js (TypeScript) | Commander.js | simple-git | Google AI Studio (Gemini 2.5 Flash) | js-yaml, chalk, dotenv

---

## Phase 1 -- CLI "Diff-to-Post" MVP

The local CLI reads diffs from a Git repo, calls an LLM to generate a problem/solution narrative, and outputs platform-specific drafts to stdout or markdown.

### 1.1 Project Scaffold

| Task | Status | Notes |
|------|--------|-------|
| `package.json` with deps and `"bin": { "sushi": ... }` | DONE | Commander, simple-git, js-yaml, chalk, dotenv, inquirer |
| `tsconfig.json` (ES2022, NodeNext, strict) | DONE | outDir `dist/`, rootDir `src/` |
| `.gitignore` (node_modules, dist, .env, .bip) | DONE | |
| Directory structure: `src/`, `src/commands/`, `src/lib/` | DONE | |
| npm scripts: `build`, `dev`, `start`, `test`, `test:watch` | DONE | |

### 1.2 CLI Entry Point

| Task | Status | Notes |
|------|--------|-------|
| `src/index.ts` Commander program with shebang | DONE | Registers all commands, loads dotenv |
| Register `init` command | DONE | |
| Register `summarize` command | DONE | `sushi summarize --commit <sha>` |
| Register `generate` command | DONE | `sushi generate --commit <sha> [--save]` |
| Register Phase 2 bootstrap commands | DONE | `sushi ingest-github`, `sushi run-worker` |

### 1.3 `sushi init` Command

| Task | Status | Notes |
|------|--------|-------|
| Interactive prompts (name, platforms, tone) via inquirer | DONE | Defaults from Git user name |
| Write `.bip/config.yml` via js-yaml | DONE | Creates `.bip/` dir if missing |
| Overwrite guard for existing config | DONE | Confirmation prompt before replacing |
| Success + policy-safe messaging | DONE | Reminds users about manual posting and platform rules |
| Terminal banner branding | DONE | Prints SUSHI banner during init |

### 1.4 Git Parser (`src/lib/git-parser.ts`)

| Task | Status | Notes |
|------|--------|-------|
| `parseDiff(commitSha, repoPath?)` function | DONE | Uses simple-git |
| Extract commit metadata (hash, message, author, date) | DONE | |
| Extract raw patch and split per-file | DONE | |
| `FileDiff` interface (filename, additions, deletions, rawDiff) | DONE | |
| `DiffResult` interface (commitSha, message, author, date, files) | DONE | |

### 1.5 Config Loader

| Task | Status | Notes |
|------|--------|-------|
| `src/lib/config.ts` load/validate `.bip/config.yml` | DONE | Shared typed `BipConfig` |
| Error handling for missing/malformed config | DONE | Includes `npx @ayudb1304/sushi init` guidance |

### 1.6 LLM Integration (`src/lib/llm.ts`)

| Task | Status | Notes |
|------|--------|-------|
| Google AI Studio client (Gemini 2.5 Flash) | DONE | `@google/generative-ai` SDK |
| `.env` config for `GEMINI_API_KEY` | DONE | |
| Prompt design (JSON-in/JSON-out) | DONE | |
| Anti-hallucination constraints | DONE | |
| Token budget awareness | DONE | Raw diffs capped at 3000 chars per file |
| Token/cost telemetry estimates | DONE | Input/output token estimates + estimated USD |

### 1.7 `sushi summarize` Command

| Task | Status | Notes |
|------|--------|-------|
| `src/commands/summarize.ts` | DONE | `sushi summarize --commit <sha>` |
| Load config, parse diff, call LLM | DONE | |
| Pretty-print output with chalk | DONE | |
| Save narrative JSON to `.bip/narratives/<sha>.json` | DONE | |
| Memory-aware context injection | DONE | Pulls relevant entries from `.bip/memory.json` |
| Error reporting hooks | DONE | Logs command errors to telemetry stream |

### 1.8 `sushi generate` Command

| Task | Status | Notes |
|------|--------|-------|
| `src/commands/generate.ts` | DONE | `sushi generate --commit <sha> [--save]` |
| Platform-specific templates (`src/lib/templates.ts`) | DONE | X + LinkedIn |
| Tone application from config | DONE | Technical / Professional / Casual |
| Output drafts per platform to stdout | DONE | |
| Optional write drafts to `.bip/drafts/` as markdown | DONE | `--save` |
| Memory writeback + telemetry logging | DONE | Updates memory and logs generation telemetry |
| Dogfood-driven file-list truncation | DONE | Caps file list and adds `...and N more` suffix |

### 1.9 Local Draft Storage + Narrative Memory

| Task | Status | Notes |
|------|--------|-------|
| `.bip/drafts/` directory for saved drafts | DONE | |
| `.bip/narratives/` for narrative JSON | DONE | |
| `.bip/memory.json` continuity memory | DONE | Recent narratives used for context continuity |
| `.bip/telemetry/events.jsonl` monitoring stream | DONE | Generation telemetry + command errors |

### 1.10 Testing

| Task | Status | Notes |
|------|--------|-------|
| Vitest config and test scripts | DONE | |
| `config.test.ts` | DONE | Config validation coverage |
| `git-parser.test.ts` | DONE | Raw patch parsing coverage |
| `templates.test.ts` | DONE | Draft rendering coverage |
| `llm.test.ts` | DONE | Prompting, JSON parsing, telemetry coverage |
| `memory.test.ts` | DONE | Memory load/save/relevance coverage |
| `phase2.test.ts` | DONE | GitHub payload parser + queue coverage |

### 1.11 Polish and Ship

| Task | Status | Notes |
|------|--------|-------|
| Error handling across commands | DONE | Missing config, API key, bad JSON, git/LLM failures |
| `--help` text for commands/options | DONE | |
| README install/usage examples | DONE | npx-first onboarding + PATH troubleshooting |
| Dogfood on real repos | DONE | See `development/dogfooding-report.md` |

---

## Phase 2 -- "Engine": Webhooks + Visual Assets

### 2.1 GitHub/GitLab Integration

| Task | Status | Notes |
|------|--------|-------|
| GitHub push payload parser | DONE | `src/lib/phase2/github.ts` |
| Event enqueue from webhook payload | DONE | `sushi ingest-github --event-file ...` |
| Webhook receiver HTTP service | TODO | Pending hosted endpoint with signature verification |
| Fetch diffs via GitHub API in worker | TODO | Current worker uses local git path |
| GitLab support | TODO | |
| Secure installation token storage | TODO | |

### 2.2 Event Processing Pipeline

| Task | Status | Notes |
|------|--------|-------|
| Event queue | DONE | Local JSONL queue in `.bip/engine/queue.jsonl` |
| Worker command | DONE | `sushi run-worker [--once]` |
| Worker pipeline (diff -> narrative -> drafts -> output) | DONE | `src/lib/phase2/worker.ts` |
| Retry/DLQ semantics | TODO | |
| Diff normalization service | TODO | |

### 2.3 Visual Asset Pipeline

| Task | Status | Notes |
|------|--------|-------|
| Snippet renderer integration | TODO | |
| Snippet selection logic | TODO | |
| Progress dashboard generator | TODO | |
| Screenshot layer via Playwright | TODO | |
| Asset storage (S3 + CDN) | TODO | |

### 2.4 Dashboard (Web UI)

| Task | Status | Notes |
|------|--------|-------|
| API server | TODO | |
| React frontend | TODO | |
| Timeline + statuses | TODO | |
| Export integrations | TODO | |
| Weekly summary cron | TODO | |

---

## Phase 3 -- "Agent": Slack/Discord Conversational Layer

All listed work remains TODO.

---

## Cross-Cutting Concerns

| Area | Status | Notes |
|------|--------|-------|
| Never auto-post by default (human-in-the-loop) | DONE | Draft-first by design |
| Platform ToS compliance messaging | DONE | README + init policy reminder |
| Anti-hallucination prompt constraints | DONE | |
| Token cost tracking per event | DONE | Estimated telemetry logged per generation |
| Monitoring and error reporting | DONE | JSONL telemetry stream for command errors + generation stats |

---

## Current Key Artifacts

- `README.md` -- npx-first onboarding, PATH troubleshooting, policy section.
- `development/dogfooding-report.md` -- real-repo dogfooding results and quality findings.
- `development/phase2-architecture.md` -- Phase 2 flow, contracts, and next tickets.
- `src/lib/memory.ts` -- continuity memory load/save/relevance.
- `src/lib/monitoring.ts` -- telemetry and error logging hooks.
- `src/lib/phase2/*` -- GitHub payload parser, queue, worker scaffolding.
