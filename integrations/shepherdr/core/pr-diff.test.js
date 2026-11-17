import { expect, test } from "bun:test";
import { inlineChanges, patchRows, fileTree, reviewItems, reviewHistory, diffMode } from "./pr-diff.js";

test("PR history retains old-commit comments even after their file leaves the diff", () => {
  const comments = [
    { id: "old", snapshot: "before", path: "removed.go", line: 37, body: "原始人工意见", status: "changes" },
    { id: "new", snapshot: "after", path: "new.go", line: 1, body: "本轮意见", status: "draft" },
  ];
  expect(reviewHistory(comments, "after")).toEqual([
    { ...comments[0], outdated: true }, { ...comments[1], outdated: false },
  ]);
  expect(comments[0].outdated).toBeUndefined();
});

test("replacement lines align across both sides without shifting later line numbers", () => {
  const { split } = patchRows("diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -5,3 +5,4 @@ fn\n same\n-old\n+new\n+extra\n tail\n");
  expect(split.map((r) => r.kind)).toEqual(["hunk", "context", "change", "add", "context"]);
  expect(split[2].left.number).toBe(6);
  expect(split[2].right.number).toBe(6);
  expect(split[3].left).toBeNull();
  expect([split[4].left.number, split[4].right.number]).toEqual([7, 8]);
});

test("new and deleted files, multiple hunks and missing final newlines retain navigation", () => {
  const { split, unified } = patchRows("@@ -0,0 +1 @@\n+new\n\\ No newline at end of file\n@@ -9 +10,0 @@\n-old\n");
  expect(split.filter((r) => r.kind === "hunk")).toHaveLength(2);
  expect(unified.filter((r) => r.kind === "delete")[0].left.number).toBe(9);
});

test("new and deleted files show their source without a blank split column", () => {
  for (const patch of ["@@ -0,0 +1,2 @@\n+first\n+second\n", "@@ -1,2 +0,0 @@\n-first\n-second\n"]) {
    const parsed = patchRows(patch);
    expect(diffMode(parsed, "split")).toBe("unified");
    expect(parsed[diffMode(parsed)].filter((r) => r.left || r.right)).toHaveLength(2);
  }
  expect(diffMode(patchRows("@@ -1 +1 @@\n-old\n+new\n"), "split")).toBe("split");
});

test("inline highlights preserve Chinese and full Unicode characters", () => {
  expect(inlineChanges("你好🐈版本一", "你好🐕版本一")).toEqual({
    left: ["你好", "🐈", "版本一"], right: ["你好", "🐕", "版本一"],
  });
  expect(inlineChanges("", "hello")).toEqual({ left: ["", "", ""], right: ["", "hello", ""] });
});

test("the file tree groups duplicate basenames by folder, folds directories and reveals search matches", () => {
  const files = ["README.md", "src/README.md", "src/代码/main.rs", "src/代码/test.rs"].map((path) => ({ path }));
  expect(fileTree(files, "", ["src"]).map((r) => r.path)).toEqual(["src", "README.md"]);
  expect(fileTree(files, "main", ["src"]).map((r) => [r.path, r.depth])).toEqual([
    ["src", 0], ["src/代码", 1], ["src/代码/main.rs", 2],
  ]);
  expect(fileTree(files).filter((r) => r.kind === "file")).toHaveLength(4);
});

test("inline review threads stay above the exact old or new source line in both modes", () => {
  const parsed = patchRows("@@ -5,2 +5,3 @@\n-old\n+new\n+extra\n tail\n");
  const comments = [
    { snapshot: "s", path: "x", line: 5, side: "LEFT", body: "old issue" },
    { snapshot: "s", path: "x", line: 6, side: "RIGHT", body: "new issue" },
    { snapshot: "stale", path: "x", line: 5, side: "LEFT", body: "stale" },
  ];
  for (const mode of ["split", "unified"]) {
    const items = reviewItems(parsed[mode], comments, { snapshot: "s", path: "x", line: 7, side: "RIGHT" }, "s", "x");
    expect(items.filter((x) => x.kind === "thread")).toHaveLength(3);
    for (const [i, item] of items.entries()) {
      if (item.kind !== "thread") continue;
      expect(items[i + 1].kind).toBe("code");
      expect(items[i + 1].row).toBe(item.row);
    }
    expect(items.flatMap((x) => x.comments ?? []).map((x) => x.body)).toEqual(["old issue", "new issue"]);
    expect(items.find((x) => x.editing).row.right.number).toBe(7);
  }
});
