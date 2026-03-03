# Sushi -- Build-in-Public Content Engine

Turn your Git commits into ready-to-post social media content. Sushi analyzes your diffs with AI and generates drafts for X/Twitter and LinkedIn -- so you can build in public without the context-switching.

## Quick Start (AI IDE users)

Using Cursor, Windsurf, or another AI-powered IDE? Paste this prompt into your agent and it will handle everything:

> Use `npx @ayudb1304/sushi` for all Sushi commands (do not install globally).
> Create a `.env` file in my project root with `GEMINI_API_KEY=<my-key>` (ask me for
> the key if I haven't provided it). Then run `npx @ayudb1304/sushi init` to set up
> the config -- use my git username as the name, select both X and LinkedIn, and pick
> Technical tone. Finally, run
> `npx @ayudb1304/sushi generate --commit HEAD --save` to generate social media drafts
> for my latest commit.

That's it -- you'll have X and LinkedIn drafts in `.bip/drafts/` within a minute.

---

## Install (manual)

Run directly without installing (recommended):

```bash
npx @ayudb1304/sushi generate --commit HEAD
```

Optional: install globally for a shorter command:

```bash
npm install -g @ayudb1304/sushi
```

Then use:

```bash
sushi generate --commit HEAD
```

If global install succeeds but `sushi` is not found, see [PATH troubleshooting](#path-troubleshooting-global-install-users).

## Setup (one time)

### 1. Get a free Gemini API key

Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and create one. Sushi uses your own key -- we never see or store it.

### 2. Set the key in your environment

```bash
export GEMINI_API_KEY="your-key-here"
```

Or create a `.env` file in the repo where you run Sushi:

```
GEMINI_API_KEY=your-key-here
```

### 3. Initialize Sushi in your project

```bash
cd your-project
npx @ayudb1304/sushi init
```

This prompts for your name, platforms (X, LinkedIn), and preferred tone (Technical, Professional, Casual), then saves the config to `.bip/config.yml`.

If you installed globally and your shell can resolve `sushi`, you can run:

```bash
sushi init
```

## Usage

### Generate social media drafts from a commit

```bash
npx @ayudb1304/sushi generate --commit HEAD
```

This analyzes the commit, calls Gemini to understand what changed and why, then prints platform-specific drafts to your terminal:

- **X/Twitter** -- a concise tweet or auto-threaded post (stays under 280 chars per part)
- **LinkedIn** -- a build-log format with problem, solution, risks, and your name

Add `--save` to write the drafts as markdown files:

```bash
npx @ayudb1304/sushi generate --commit abc1234 --save
# Saves to .bip/drafts/abc1234-x.md and .bip/drafts/abc1234-linkedin.md
```

### Just get the narrative (no social drafts)

```bash
npx @ayudb1304/sushi summarize --commit abc1234
```

Prints the raw problem/solution/risk/testing-notes analysis and saves it as JSON to `.bip/narratives/`.

## Commands

| Command | Description |
|---------|-------------|
| `npx @ayudb1304/sushi init` | Interactive setup -- creates `.bip/config.yml` |
| `npx @ayudb1304/sushi summarize --commit <sha>` | Analyze a commit, print the narrative |
| `npx @ayudb1304/sushi generate --commit <sha> [--save]` | Generate X + LinkedIn drafts from a commit |

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

## Requirements

- Node.js >= 18
- Git
- A [Gemini API key](https://aistudio.google.com/apikey) (free tier works fine)

## Contributing

```bash
git clone https://github.com/ayudb1304-wq/bip-cli.git
cd bip-cli
npm install
npm test        # 30 tests across 4 suites
npm run dev -- generate --commit HEAD
```

## License

MIT
