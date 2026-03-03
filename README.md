# Sushi -- Build-in-Public Content Engine

Turn your Git commits into ready-to-post social media drafts. Sushi reads your code changes and helps you share progress on X and LinkedIn without writing from scratch.

## Start Here (30 seconds)

No API key required for first success.

```bash
npx @ayudb1304/sushi quickstart
```

What this does:
- creates `.bip/config.yml` with beginner defaults if missing
- generates demo drafts instantly (local mode)
- saves drafts to `.bip/drafts/`
- tells you the exact next step for real AI drafts

## Step 2: Get Real AI Drafts

1. Create a free Gemini key: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. In your project root, add a `.env` file:

```env
GEMINI_API_KEY=your-key-here
```

3. Run quickstart again:

```bash
npx @ayudb1304/sushi quickstart
```

## Everyday Usage

Generate drafts from your latest commit:

```bash
npx @ayudb1304/sushi generate --commit HEAD --save
```

If `HEAD` is unfamiliar, it just means "your latest commit in this repo."

Just get the narrative summary:

```bash
npx @ayudb1304/sushi summarize --commit HEAD
```

Run setup diagnostics:

```bash
npx @ayudb1304/sushi doctor
```

## Clone-Repo Setup (optional)

If you cloned this repo and want local scripts:

```bash
npm run setup
npm run quickstart
```

## Commands

| Command | Description |
|---------|-------------|
| `npx @ayudb1304/sushi quickstart` | One-command onboarding (demo-first, real mode when key exists) |
| `npx @ayudb1304/sushi doctor` | Check Node, Git, config, and Gemini key readiness |
| `npx @ayudb1304/sushi init` | Interactive setup for custom profile/platform/tone |
| `npx @ayudb1304/sushi summarize --commit <sha>` | Analyze a commit and print narrative |
| `npx @ayudb1304/sushi generate --commit <sha> [--save]` | Generate X + LinkedIn drafts from a commit |
| `npx @ayudb1304/sushi ingest-github --event-file <path> [--repo-path <path>]` | Queue GitHub push webhook commits for processing |
| `npx @ayudb1304/sushi run-worker [--once]` | Process queued events and write outputs to `.bip/engine/outputs/` |
| `npx @ayudb1304/sushi serve-webhooks [--port 8787] [--host 0.0.0.0]` | Run GitHub webhook receiver (`POST /webhooks/github`) with signature verification |
| `npx @ayudb1304/sushi serve-dashboard [--port 8788] [--host 0.0.0.0]` | Run dashboard API + timeline UI |
| `npx @ayudb1304/sushi run-weekly-summary [--once] [--interval-hours 168]` | Generate weekly summary markdown on schedule |

## Advanced Setup

## Phase 2 Engine setup

### Required environment variables

Set these before running live webhook + worker flows:

```bash
# Required for webhook signature verification
export GITHUB_WEBHOOK_SECRET="your-webhook-secret"

# Required for encrypted installation token storage (min 16 chars)
export BIP_TOKEN_MASTER_KEY="replace-with-strong-secret"
```

Optional but useful:

```bash
# Fallback token used when webhook Authorization header is not provided
export GITHUB_INSTALLATION_TOKEN="ghp_xxx"

# Optional asset upload (if set, generated assets upload to S3)
export AWS_REGION="us-east-1"
export BIP_ASSET_BUCKET="your-bucket-name"
export BIP_ASSET_CDN_BASE_URL="https://cdn.example.com" # optional
```

### End-to-end Phase 2 flow

0. Build the modern dashboard frontend (one-time, or after UI changes):

```bash
npm --prefix dashboard install
npm run dashboard:build
```

1. Start webhook receiver:

```bash
npx @ayudb1304/sushi serve-webhooks --port 8787
```

2. Point GitHub webhook to:

```text
POST http://<your-host>:8787/webhooks/github
```

3. Process queued events:

```bash
npx @ayudb1304/sushi run-worker
```

4. Inspect timeline and assets:

```bash
# if you changed dashboard UI, rebuild before serving
npm run dashboard:build
npx @ayudb1304/sushi serve-dashboard --port 8788
# open http://localhost:8788
```

5. Generate weekly summary:

```bash
npx @ayudb1304/sushi run-weekly-summary --once
```

## PATH troubleshooting (global install users)

If `npm install -g @ayudb1304/sushi` succeeds but `sushi` shows `command not found`,
your npm global bin directory is not in your shell `PATH`.

1. Find your npm global prefix:

```bash
npm config get prefix
```

2. Add `<prefix>/bin` to your PATH (zsh):

```bash
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
hash -r
```

3. Verify:

```bash
which sushi
sushi --version
```

If you want zero shell setup, use `npx @ayudb1304/sushi ...` instead of global install.

## How it works

```
git commit --> sushi extracts diff --> Gemini analyzes changes --> platform drafts
```

1. **Parses** the commit diff (files changed, additions, deletions, raw patches)
2. **Sends** structured context to Gemini 2.5 Flash with anti-hallucination constraints
3. **Generates** a problem/solution narrative grounded in the actual code changes
4. **Renders** platform-specific drafts using your configured tone

Sushi never auto-posts. You review, edit, and post on your own terms.

## Platform safety and policy

- Sushi is draft-first and human-in-the-loop: it does not auto-post by default.
- You remain responsible for platform policies for X, LinkedIn, Reddit, and any other channel.
- Recommended flow: generate drafts in Sushi, review/edit, then post manually or via approved publishing tools.

## Requirements

- Node.js >= 18
- Git
- A [Gemini API key](https://aistudio.google.com/apikey) (free tier works fine)

## Contributing

```bash
git clone https://github.com/ayudb1304-wq/bip-cli.git
cd bip-cli
npm install
npm test
npm run dev -- generate --commit HEAD
```

## License

MIT
