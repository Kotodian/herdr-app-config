// The same grammar tokens in native and web review; no HTML or DOM is needed.
import hljs from "./pr-syntax-engine.js";

const extensions = {
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  rs: "rust", py: "python", rb: "ruby", kt: "kotlin", cs: "csharp",
  sh: "bash", zsh: "bash", yml: "yaml", toml: "ini", md: "markdown",
  html: "xml", htm: "xml", vue: "xml", svg: "xml", h: "c", hpp: "cpp", cc: "cpp",
  jsonc: "json", webmanifest: "json",
};
export function diffLanguage(path) {
  const name = path.split("/").pop() || "";
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  const language = name === "Makefile" ? "makefile" : extensions[ext] || ext;
  return language && hljs.getLanguage(language) ? language : null;
}

export function syntaxLines(text, language) {
  const lines = [[]];
  const emit = (text, scope) => {
    const pieces = text.split("\n");
    pieces.forEach((piece, i) => {
      if (i) lines.push([]);
      if (piece) lines[lines.length - 1].push({ text: piece, scope });
    });
  };
  const walk = (node, scope = "") => {
    if (typeof node === "string") emit(node, scope);
    else for (const child of node.children || []) walk(child, node.scope || scope);
  };
  try {
    // This is highlight.js's pinned token-tree emitter; the regression tests also verify exact source recovery.
    if (language && text.length <= 300_000) walk(hljs.highlight(text, { language, ignoreIllegals: true })._emitter.rootNode);
    else emit(text, "");
  } catch { return text.split("\n").map((text) => [{ text, scope: "" }]); }
  return lines;
}

export function colorDiff(parsed, path) {
  const language = diffLanguage(path), hunks = [];
  for (const row of parsed.split) {
    if (row.kind === "hunk") hunks.push([]);
    else if (hunks.length) hunks[hunks.length - 1].push(row);
  }
  for (const rows of hunks) for (const key of ["left", "right"]) {
    const sides = rows.map((row) => row[key]).filter(Boolean);
    const tokens = syntaxLines(sides.map((side) => side.text).join("\n"), language);
    sides.forEach((side, i) => { side.tokens = tokens[i] || []; });
  }
  return parsed;
}

// Intersect syntax spans with the inline replacement range, preserving both kinds of highlighting.
export function codeSpans(side, pieces) {
  if (!side) return [];
  const from = pieces ? pieces[0].length : -1, to = pieces ? from + pieces[1].length : -1;
  let offset = 0;
  return (side.tokens || [{ text: side.text, scope: "" }]).flatMap((token) => {
    const start = offset; offset += token.text.length;
    const cuts = [start, ...[from, to].filter((x) => x > start && x < offset), offset];
    return cuts.slice(0, -1).map((at, i) => ({ text: token.text.slice(at - start, cuts[i + 1] - start),
      scope: token.scope, changed: at >= from && at < to }));
  });
}

export function syntaxColor(scope, light = false) {
  const dark = { keyword: "#cc7832", string: "#6aab73", comment: "#8b949e", number: "#6897bb",
    function: "#ffc66d", type: "#a0c3ec", constant: "#9876aa", meta: "#bbb529", tag: "#e8bf6a" };
  const paper = { keyword: "#9b3d16", string: "#267d32", comment: "#6b7280", number: "#145a9c",
    function: "#795e26", type: "#216980", constant: "#7b438e", meta: "#786600", tag: "#895c0a" };
  const colors = light ? paper : dark;
  if (/comment|quote/.test(scope)) return colors.comment;
  if (/string|regexp|symbol/.test(scope)) return colors.string;
  if (/keyword|literal|built_in|operator/.test(scope)) return colors.keyword;
  if (/number|bullet/.test(scope)) return colors.number;
  if (/class|type/.test(scope)) return colors.type;
  if (/title|section/.test(scope)) return colors.function;
  if (/constant|attr/.test(scope)) return colors.constant;
  if (/meta|doctag/.test(scope)) return colors.meta;
  if (/tag|name|selector/.test(scope)) return colors.tag;
  return null;
}
