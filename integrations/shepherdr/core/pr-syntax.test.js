import { expect, test } from "bun:test";
import { patchRows } from "./pr-diff.js";
import { codeSpans, colorDiff, diffLanguage, syntaxLines } from "./pr-syntax.js";

test("language grammars preserve source and recognize tokens in the user's code languages", () => {
  for (const [file, text] of [
    ["source.go", 'func greeting(name string) string { return "你好" }'],
    ["source.rs", 'pub fn greeting() -> String { String::from("你好") }'],
    ["source.ts", 'export function greeting(name: string) { return "你好" }'],
    ["data.json", '{"count": 42, "name": "你好"}'],
    ["run.sh", 'if true; then echo "你好"; fi'],
  ]) {
    const language = diffLanguage(file), lines = syntaxLines(text, language);
    expect(language).not.toBeNull();
    expect(lines.flat().map((x) => x.text).join("")).toBe(text);
    expect(lines.flat().some((x) => x.scope)).toBe(true);
  }
});

test("block comments keep their language coloring over multiple diff rows", () => {
  const parsed = colorDiff(patchRows("@@ -1,3 +1,3 @@\n /* comment\n-still old\n+still new\n */\n"), "source.go");
  const row = parsed.split[2];
  expect(row.left.tokens.every((x) => x.scope === "comment")).toBe(true);
  expect(row.right.tokens.every((x) => x.scope === "comment")).toBe(true);
  expect(parsed.unified.find((x) => x.kind === "add").right.tokens).toBe(row.right.tokens);
});

test("syntax colors and replacement highlights share exact character boundaries", () => {
  const parsed = colorDiff(patchRows('@@ -1 +1 @@\n-return "你好🐈"\n+return "你好🐕"\n'), "source.ts");
  const row = parsed.split[1], spans = codeSpans(row.right, row.inline.right);
  expect(spans.map((x) => x.text).join("")).toBe(row.right.text);
  expect(spans.filter((x) => x.changed).map((x) => x.text).join("")).toBe("🐕");
  expect(spans.find((x) => x.changed).scope).toBe("string");
});

test("unknown file types keep their exact plain text", () => {
  expect(diffLanguage("unknown.custom")).toBeNull();
  expect(syntaxLines("<script>& 你好\n", null).flat().map((x) => x.text).join("")).toBe("<script>& 你好");
});
