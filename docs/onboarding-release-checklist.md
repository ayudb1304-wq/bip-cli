# Onboarding Release Checklist

- Run `npm run onboarding:smoke` and confirm it passes.
- Run `npm run test` and confirm onboarding tests pass.
- Validate `npx @ayudb1304/sushi quickstart` in a clean folder with no `.env`:
  - First output appears quickly and clearly says demo mode.
  - `.bip/config.yml` and draft files are created.
- Validate `npx @ayudb1304/sushi quickstart` with `GEMINI_API_KEY` set:
  - Real mode runs and prints generated drafts.
- Run `npx @ayudb1304/sushi doctor` and confirm checks are readable for beginners.
