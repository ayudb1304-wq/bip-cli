import { describe, it, expect } from "vitest";
import { parseRawPatch } from "../lib/git-parser.js";

const SINGLE_FILE_PATCH = `diff --git a/src/index.ts b/src/index.ts
index abc1234..def5678 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,4 @@
 import { Command } from "commander";
+import chalk from "chalk";
 
 const program = new Command();`;

const MULTI_FILE_PATCH = `diff --git a/src/foo.ts b/src/foo.ts
index 1111111..2222222 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,2 +1,3 @@
 const a = 1;
+const b = 2;
 export default a;
diff --git a/src/bar.ts b/src/bar.ts
index 3333333..4444444 100644
--- a/src/bar.ts
+++ b/src/bar.ts
@@ -5,3 +5,2 @@
 function hello() {
-  console.log("old");
   console.log("new");
 }`;

describe("parseRawPatch", () => {
  it("parses a single-file diff", () => {
    const files = parseRawPatch(SINGLE_FILE_PATCH);
    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe("src/index.ts");
    expect(files[0].additions).toBe(1);
    expect(files[0].deletions).toBe(0);
    expect(files[0].rawDiff).toContain("import chalk");
  });

  it("parses a multi-file diff", () => {
    const files = parseRawPatch(MULTI_FILE_PATCH);
    expect(files).toHaveLength(2);

    expect(files[0].filename).toBe("src/foo.ts");
    expect(files[0].additions).toBe(1);
    expect(files[0].deletions).toBe(0);

    expect(files[1].filename).toBe("src/bar.ts");
    expect(files[1].additions).toBe(0);
    expect(files[1].deletions).toBe(1);
  });

  it("returns empty array for empty input", () => {
    expect(parseRawPatch("")).toEqual([]);
  });

  it("returns empty array for non-diff text", () => {
    expect(parseRawPatch("just some random text")).toEqual([]);
  });

  it("handles a patch with only additions", () => {
    const patch = `diff --git a/new.txt b/new.txt
new file mode 100644
index 0000000..abcdef1
--- /dev/null
+++ b/new.txt
@@ -0,0 +1,3 @@
+line one
+line two
+line three`;

    const files = parseRawPatch(patch);
    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe("new.txt");
    expect(files[0].additions).toBe(3);
    expect(files[0].deletions).toBe(0);
  });
});
