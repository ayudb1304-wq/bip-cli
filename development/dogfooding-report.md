# Dogfooding Report (Phase 1)

Date: 2026-03-03

## Scope

Ran Sushi `generate --commit HEAD --save` against 3 real open-source repositories:

1. `sindresorhus/ky`
2. `chalk/chalk`
3. `lodash/lodash`

All runs were executed with local `.bip/config.yml` and produced:

- X draft markdown in `.bip/drafts/<sha>-x.md`
- LinkedIn draft markdown in `.bip/drafts/<sha>-linkedin.md`
- narrative memory updates in `.bip/memory.json`
- telemetry entries in `.bip/telemetry/events.jsonl`

## Findings

### What worked

- End-to-end generation succeeded across all three repositories.
- Large, multi-file commits were handled without command crashes.
- Cost telemetry surfaced useful budget signals per run.

### Quality issues observed

1. **Overlong file lists** in X/LinkedIn outputs for large commits.
2. Commit messages can be misleading for mega-commits, causing weaker problem framing.
3. Testing notes can become too verbose for social posting contexts.

## Focused improvement pass applied

- Implemented file-list truncation in `renderDrafts()`:
  - Show first 8 files by default.
  - Add `...and N more file(s)` suffix when commits touch many files.
- This keeps platform outputs scannable while preserving change breadth.

## Follow-up recommendations

1. Add optional “summary density” mode (`brief | standard | deep`) per platform.
2. Add commit-size heuristic to request shorter LLM testing notes for social channels.
3. Add prompt guidance for mega-commits to explicitly note uncertainty and avoid over-claiming intent.
