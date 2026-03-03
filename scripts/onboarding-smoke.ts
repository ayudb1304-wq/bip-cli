import { performance } from "node:perf_hooks";
import { buildSyntheticDiff, buildDemoNarrative } from "../src/lib/onboarding.js";

const start = performance.now();
const diff = buildSyntheticDiff(process.cwd());
const narrative = buildDemoNarrative(diff);
const elapsedMs = performance.now() - start;

console.log(`Onboarding demo prep time: ${elapsedMs.toFixed(2)}ms`);
console.log(`Problem preview: ${narrative.problem}`);

if (elapsedMs > 30_000) {
  console.error("Onboarding SLA failed: first success path exceeded 30 seconds.");
  process.exit(1);
}

console.log("Onboarding SLA check passed (<30s).");
