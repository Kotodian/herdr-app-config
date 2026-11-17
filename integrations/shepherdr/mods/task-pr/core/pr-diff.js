// PR diff rows shared by the window and web: align replacements, keep both line numbers and hunk navigation.
const tabs = (s) => s.replace(/[^\t]*\t/g, (x) => x.slice(0, -1).padEnd(Math.ceil(x.length / 4) * 4));
const side = (number, text) => ({ number, text: tabs(text) });

// A new/deleted file has only one version to show; do not put its content beyond an empty split column.
export function diffMode(parsed, preferred = "split") {
  const source = parsed.split.filter((row) => row.kind !== "hunk");
  return source.length && (source.every((row) => !row.left) || source.every((row) => !row.right)) ? "unified" : preferred;
}

// Keep feedback immediately above its source row, regardless of split/unified layout.
export function reviewItems(rows, comments, target, snapshot, path) {
  const pending = comments.filter((c) => c.snapshot === snapshot && c.path === path && c.line);
  const matches = (row, c) => row[c.side === "LEFT" ? "left" : "right"]?.number === c.line;
  return rows.flatMap((row, index) => {
    const key = JSON.stringify([snapshot, path, row.left?.number, row.right?.number, row.kind]);
    const notes = pending.filter((c) => matches(row, c));
    const editing = Boolean(target && target.snapshot === snapshot && target.path === path && matches(row, target));
    const code = { kind: "code", key: `code:${key}`, row, index, height: 23 };
    return notes.length || editing
      ? [{ kind: "thread", key: `thread:${key}`, row, index, comments: notes, editing,
          height: notes.length * 100 + (editing ? 218 : 8) }, code]
      : [code];
  });
}

// Every human comment remains in the PR history, even if its file or line left the new diff.
export function reviewHistory(comments, snapshot) {
  return comments.map((comment) => ({ ...comment, outdated: comment.snapshot !== snapshot }));
}

// Stable directory rows for the PR's changed files, with folders before files at each level.
export function fileTree(files, query = "", collapsed = []) {
  const root = { dirs: new Map(), files: [] }, folded = new Set(collapsed), rows = [];
  for (const file of files) {
    if (query && !file.path.toLowerCase().includes(query.toLowerCase())) continue;
    const parts = file.path.split("/"), name = parts.pop();
    let node = root, path = "";
    for (const part of parts) {
      path = path ? `${path}/${part}` : part;
      if (!node.dirs.has(part)) node.dirs.set(part, { path, dirs: new Map(), files: [], count: 0 });
      node = node.dirs.get(part); node.count++;
    }
    node.files.push({ file, name });
  }
  const visit = (node, depth) => {
    for (const [name, dir] of [...node.dirs].sort(([a], [b]) => a.localeCompare(b))) {
      rows.push({ kind: "directory", name, path: dir.path, depth, count: dir.count, folded: !query && folded.has(dir.path) });
      if (query || !folded.has(dir.path)) visit(dir, depth + 1);
    }
    for (const { file, name } of node.files.sort((a, b) => a.name.localeCompare(b.name)))
      rows.push({ kind: "file", path: file.path, name, depth, file });
  };
  visit(root, 0);
  return rows;
}

export function inlineChanges(left, right) {
  if (left == null || right == null || left === right) return null;
  const a = Array.from(left), b = Array.from(right);
  let begin = 0, end = 0;
  while (begin < Math.min(a.length, b.length) && a[begin] === b[begin]) begin++;
  while (end < Math.min(a.length, b.length) - begin && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
  const pieces = (x) => [x.slice(0, begin).join(""), x.slice(begin, x.length - end).join(""), end ? x.slice(-end).join("") : ""];
  return { left: pieces(a), right: pieces(b) };
}

export function patchRows(patch) {
  const split = [], unified = [], removed = [], added = [];
  let old = 0, next = 0, started = false;
  const flush = () => {
    for (let i = 0; i < Math.max(removed.length, added.length); i++) {
      const left = removed[i] ?? null, right = added[i] ?? null;
      split.push({ kind: left && right ? "change" : left ? "delete" : "add", left, right,
        inline: inlineChanges(left?.text, right?.text) });
    }
    removed.length = added.length = 0;
  };
  for (const line of String(patch).split("\n")) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/.exec(line);
    if (hunk) {
      flush(); old = Number(hunk[1]); next = Number(hunk[2]); started = true;
      const row = { kind: "hunk", text: `@@ −${hunk[1]}  +${hunk[2]} @@${hunk[3]}` };
      split.push(row); unified.push(row);
    } else if (started && line.startsWith("-")) {
      const left = side(old++, line.slice(1));
      removed.push(left); unified.push({ kind: "delete", left, right: null });
    } else if (started && line.startsWith("+")) {
      const right = side(next++, line.slice(1));
      added.push(right); unified.push({ kind: "add", left: null, right });
    } else if (started && line.startsWith(" ")) {
      flush();
      const row = { kind: "context", left: side(old++, line.slice(1)), right: side(next++, line.slice(1)) };
      split.push(row); unified.push(row);
    } else if (started && line.startsWith("\\ No newline")) {
      // A marker is not a source line and must never move either line number.
    }
  }
  flush();
  return { split, unified };
}
