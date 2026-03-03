# BiP MVP Implementation Tracker

> Build-in-Public Content Engine -- transforms Git diffs into platform-specific social media drafts.

**Stack:** Node.js (TypeScript) | Commander.js | simple-git | Google AI Studio (Gemini 2.5 Flash) | js-yaml, chalk, dotenv

---

## Phase 1 -- CLI "Diff-to-Post" MVP

The core local CLI tool. Reads diffs from a local Git repo, calls an LLM to generate a problem/solution narrative, and outputs platform-specific text drafts to stdout or a markdown file.

### 1.1 Project Scaffold

| Task | Status | Notes |
|------|--------|-------|
| `package.json` with deps and `"bin": { "bip": ... }` | DONE | commander, simple-git, js-yaml, chalk, dotenv, inquirer |
| `tsconfig.json` (ES2022, NodeNext, strict) | DONE | outDir `dist/`, rootDir `src/` |
| `.gitignore` (node_modules, dist, .env, .bip) | DONE | |
| Directory structure: `src/`, `src/commands/`, `src/lib/` | DONE | |
| npm scripts: `build`, `dev`, `start`, `test`, `test:watch` | DONE | `tsc`, `tsx src/index.ts`, `node dist/index.js`, `vitest run`, `vitest` |

### 1.2 CLI Entry Point

| Task | Status | Notes |
|------|--------|-------|
| `src/index.ts` -- Commander program, shebang, version 0.1.0 | DONE | Registers all subcommands, loads dotenv |
| Register `init` command | DONE | |
| Register `summarize` command | DONE | `bip summarize --commit <sha>` |
| Register `generate` command | DONE | `bip generate --commit <sha> [--save]` |

### 1.3 `bip init` Command

| Task | Status | Notes |
|------|--------|-------|
| Interactive prompts (name, platforms, tone) via inquirer | DONE | Defaults: Ayush Bhiogade, [x, linkedin], Technical |
| Write `.bip/config.yml` via js-yaml | DONE | Creates `.bip/` dir if missing |
| Overwrite guard for existing config | DONE | Confirmation prompt before replacing |
| Success message with chalk | DONE | |

### 1.4 Git Parser (`src/lib/git-parser.ts`)

| Task | Status | Notes |
|------|--------|-------|
| `parseDiff(commitSha, repoPath?)` function | DONE | Uses simple-git |
| Extract commit metadata (hash, message, author, date) | DONE | Via `git.log()` |
| Extract raw patch and split per-file | DONE | Splits on `diff --git` boundaries |
| `FileDiff` interface (filename, additions, deletions, rawDiff) | DONE | Counts `+`/`-` lines excluding `+++`/`---` headers |
| `DiffResult` interface (commitSha, message, author, date, files) | DONE | |

### 1.5 Config Loader

| Task | Status | Notes |
|------|--------|-------|
| `src/lib/config.ts` -- load and validate `.bip/config.yml` | DONE | Read YAML, return typed `BipConfig` object. Shared interface used by `init.ts` |
| Error handling for missing/malformed config | DONE | Validates user.name, platforms (non-empty array), tone (string) |

### 1.6 LLM Integration (`src/lib/llm.ts`)

| Task | Status | Notes |
|------|--------|-------|
| Google AI Studio client (Gemini 2.5 Flash) | DONE | `@google/generative-ai` SDK, JSON response mode |
| `.env` config for `GEMINI_API_KEY` | DONE | Loaded via `dotenv/config` in entry point, `.env.example` provided |
| Design "commit story" prompt (JSON-in / JSON-out) | DONE | Input: diff metadata + raw patches. Output: `{ problem, solution, risk, testingNotes }` |
| Anti-hallucination constraints in prompt | DONE | "ONLY reference entities in context", "Do NOT invent", "state unclear if unsure" |
| Token budget awareness | DONE | Raw diffs capped at 3000 chars per file in prompt |

### 1.7 `bip summarize` Command

| Task | Status | Notes |
|------|--------|-------|
| `src/commands/summarize.ts` | DONE | `bip summarize --commit <sha>` |
| Load config, call git-parser, call LLM | DONE | Pipe DiffResult into prompt, print narrative to stdout |
| Pretty-print output with chalk | DONE | Problem, solution, risk, testing notes in colored sections |
| Save narrative JSON to `.bip/narratives/<sha>.json` | DONE | Auto-creates directory |

### 1.8 `bip generate` Command

| Task | Status | Notes |
|------|--------|-------|
| `src/commands/generate.ts` | DONE | `bip generate --commit <sha> [--save]` |
| Platform-specific templates (`src/lib/templates.ts`) | DONE | X (tweet/thread, 280 char budget), LinkedIn (build-log format) |
| Tone application from config | DONE | Technical / Professional / Casual tone styles |
| Output drafts per platform to stdout | DONE | Labeled by platform, thread parts shown separately for X |
| Optional: write drafts to `.bip/drafts/` as markdown | DONE | `--save` flag writes `<sha>-<platform>.md` files |

### 1.9 Local Draft Storage

| Task | Status | Notes |
|------|--------|-------|
| `.bip/drafts/` directory for saved drafts | DONE | Created by `bip generate --save` |
| `.bip/narratives/` for raw LLM narrative JSON | DONE | Created by `bip summarize` and `bip generate --save` |
| Narrative memory for referential continuity | TODO | Past summaries enable "Continuing last week's work on..." |

### 1.10 Testing

| Task | Status | Notes |
|------|--------|-------|
| Vitest config and test scripts | DONE | `vitest.config.ts`, `npm test`, `npm run test:watch` |
| `config.test.ts` -- loadConfig validation | DONE | 6 tests: valid config, missing file, malformed fields |
| `git-parser.test.ts` -- parseRawPatch unit tests | DONE | 5 tests: single/multi file, empty, additions-only |
| `templates.test.ts` -- renderDrafts output | DONE | 11 tests: platform selection, tone, threading, risk omission |
| `llm.test.ts` -- prompt building and mocked API | DONE | 8 tests: metadata, constraints, JSON parsing, error handling |

### 1.11 Polish and Ship

| Task | Status | Notes |
|------|--------|-------|
| Error handling across all commands | DONE | Missing config, missing API key, bad JSON, git errors |
| `--help` text for every command and option | DONE | Commander auto-generates from descriptions |
| README with install instructions and usage examples | TODO | |
| Dogfood on own repos | TODO | Generate real posts, validate quality |

---

## Phase 2 -- "Engine": Webhooks + Visual Assets

Multi-tenant web service with GitHub/GitLab integration, visual asset generation, and a draft management dashboard.

### 2.1 GitHub/GitLab Integration

| Task | Status | Notes |
|------|--------|-------|
| Build GitHub App (OAuth + webhooks) | TODO | Subscribe to push and PR events |
| Webhook receiver for push/PR/tag events | TODO | |
| Fetch diffs via GitHub API (`GET /commits/:sha` with diff accept header) | TODO | |
| GitLab support (commit diff API) | TODO | |
| Store installation tokens securely | TODO | |

### 2.2 Event Processing Pipeline

| Task | Status | Notes |
|------|--------|-------|
| Event queue (RabbitMQ / SQS) | TODO | |
| Worker: fetch diff, run narrative pipeline, call visual services | TODO | |
| Diff Normalization Service | TODO | Structured schema: files, hunks, domain hints |

### 2.3 Visual Asset Pipeline

| Task | Status | Notes |
|------|--------|-------|
| Snippet renderer integration (Carbonara or Rayso-API) | TODO | Code diff -> aesthetic card PNG |
| Snippet selection logic (most "interesting" hunk) | TODO | |
| Progress dashboard generator (SVG -> PNG) | TODO | LOC added/removed, PRs merged, tests added |
| Screenshot layer via Playwright | TODO | |
| Asset storage (S3 + CDN) | TODO | |

### 2.4 Dashboard (Web UI)

| Task | Status | Notes |
|------|--------|-------|
| API server (Node/TypeScript) | TODO | |
| React frontend for browsing drafts and assets | TODO | |
| Timeline: events this week, statuses (drafted/edited/posted) | TODO | |
| Export: copy-to-clipboard, Typefully/Buffer integration | TODO | |
| Weekly summary cron job | TODO | Week-in-review narrative + sharable card |

### 2.5 Platform Output

| Task | Status | Notes |
|------|--------|-------|
| X draft generation (auto-split threads) | TODO | No direct posting in Phase 2 |
| LinkedIn draft generation (markdown format) | TODO | Copy-friendly, no auto-posting |
| "Long-form devlog" output for blogs/Reddit | TODO | |
| Platform-specific image sizing (X: 1200x675, LinkedIn: 1:1 or 4:5) | TODO | |

---

## Phase 3 -- "Agent": Slack/Discord Conversational Layer

Conversational bot that interviews the developer for context and proposes drafts in-channel.

### 3.1 Slack Integration

| Task | Status | Notes |
|------|--------|-------|
| Slack app with slash commands (`/bip today`, `/bip recap`) | TODO | |
| Event subscription for mentions | TODO | |
| OAuth flow: link Slack user to BiP user | TODO | |

### 3.2 Discord Integration

| Task | Status | Notes |
|------|--------|-------|
| Discord bot with equivalent commands | TODO | |
| OAuth flow | TODO | |

### 3.3 Conversational Flows

| Task | Status | Notes |
|------|--------|-------|
| Post-merge debrief script | TODO | "What was surprisingly hard about this change?" |
| Weekly reflection script | TODO | "What did you learn this week?" |
| Launch story generator script | TODO | |
| Save responses as "human flavor" snippets | TODO | Injected into future LLM prompts |

### 3.4 Voice Modeling

| Task | Status | Notes |
|------|--------|-------|
| Import existing X/LinkedIn posts (CSV or paste) | TODO | |
| Extract voice patterns (sentence length, phrases, formality, emoji) | TODO | |
| Use patterns as LLM conditioning examples | TODO | |
| Show "what we learned about your voice" summary | TODO | |

### 3.5 Review and Approve in Slack/Discord

| Task | Status | Notes |
|------|--------|-------|
| Bot posts generated drafts in-channel | TODO | 2 options per event |
| Reactions/commands to approve, regenerate, tweak tone | TODO | |

---

## Cross-Cutting Concerns

| Area | Status | Notes |
|------|--------|-------|
| Never auto-post by default (human-in-the-loop) | DONE (by design) | Phase 1 is stdout/copy only |
| Platform ToS compliance (X, LinkedIn, Reddit) | TODO | Warnings in-app, no unauthorized automation |
| Anti-hallucination prompt constraints | DONE | Covered in LLM integration |
| Token cost tracking per event | TODO | For future pricing/billing |
| Monitoring and error reporting | TODO | |

---

## Current File Map

```
BiP/
  package.json              # DONE -- bip-cli v0.1.0, all deps including @google/generative-ai
  tsconfig.json             # DONE -- ES2022 / NodeNext / strict
  vitest.config.ts          # DONE -- test config
  .gitignore                # DONE
  .env.example              # DONE -- documents GEMINI_API_KEY
  src/
    index.ts                # DONE -- CLI entry, registers init/summarize/generate, loads dotenv
    commands/
      init.ts               # DONE -- interactive config setup
      summarize.ts          # DONE -- bip summarize --commit <sha>
      generate.ts           # DONE -- bip generate --commit <sha> [--save]
    lib/
      git-parser.ts         # DONE -- parseDiff() + parseRawPatch() returns DiffResult
      config.ts             # DONE -- loadConfig() with validation, shared BipConfig interface
      llm.ts                # DONE -- Gemini 2.5 Flash client, buildPrompt(), generateNarrative()
      templates.ts          # DONE -- renderDrafts() with X/LinkedIn templates, tone support
    __tests__/
      config.test.ts        # DONE -- 6 tests
      git-parser.test.ts    # DONE -- 5 tests
      templates.test.ts     # DONE -- 11 tests
      llm.test.ts           # DONE -- 8 tests
  .bip/                     # Created at runtime by bip init
    config.yml              # Written by bip init
    drafts/                 # Created by bip generate --save
    narratives/             # Created by bip summarize / bip generate --save
  development/
    implementation.md       # This file
```
