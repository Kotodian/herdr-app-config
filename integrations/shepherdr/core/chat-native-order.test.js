import { readFileSync } from "node:fs";
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { ownWords } from "./chat-view.js";

const source = readFileSync(process.env.SHEPHERDR_CHAT_SOURCE ?? new URL("../mods/chat/main.js", import.meta.url), "utf8");
const norm = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
const same = (left, right) => norm(left) === norm(right);
const globals = {
  firstUser: (items) => items.findIndex((item) => item.kind === "user"),
  cardsOf: () => [],
  norm,
  dayOf: (at) => Math.floor(at / 86400000) * 86400000,
  dayLabel: () => "Today",
  sentTo: () => "",
  selfName: () => "",
  assistant: () => false,
  unsigned: (text) => text,
  fromName: () => "",
  home: () => "/tmp",
  mediaIn: (text) => ({ text, media: [] }),
  parts: (text) => [{ type: "md", text }],
  bandActs: () => [],
  imagesLine: (count) => `${count} images`,
  pilotLine: () => "",
  same,
  ownWords,
};

function method(name, until) {
  const start = source.indexOf(`  ${name}() {`);
  assert.notEqual(start, -1);
  const end = source.indexOf(until, start);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  return new Function(...Object.keys(globals), `return ({ ${body} }).${name}`)(...Object.values(globals));
}

const rows = method("rows", "  // How a long reply folds");
const settlePending = method("settlePending", "  // The newest page first");
const timestamp = Date.now() - 30000;
const item = (kind, id, at, text) => ({ kind, id, at, text });

function chat(items, pending = [], replied = [], queued = []) {
  return {
    start: 0, conv: { items, queued: () => queued }, pending, replied, askEnds: [], kind: "codex",
    status: () => queued.length ? "working" : "idle",
    resolveArts: () => new Map(), newsLines: () => ({ inline: new Map(), extra: [] }),
    loadAskEnds: () => {}, workerTasks: () => new Map(), timelineCards: () => [],
    brief: () => false, mentioned: () => [], pills: () => [], foldOf: () => null,
    queuedLine: (of) => ({ kind: "queued", id: `qn:${of}` }),
    spaced: (output) => output,
  };
}

function messages(instance) {
  return rows.call(instance).filter((row) => ["user", "agent", "pending", "queued", "imgs", "replyref"].includes(row.kind));
}

test("an unacknowledged older send stays ahead of newer turns and reconciles later", () => {
  const pending = { id: "pending-first", text: "first", at: timestamp, delivered: true, sent: "first", match: "first" };
  const instance = chat([item("user", "second", timestamp + 1000, "second"),
    item("agent", "answer", timestamp + 2000, "reply")], [pending]);
  assert.deepEqual(messages(instance).map((row) => row.id), ["pending-first", "second", "answer"]);
  assert.equal(pending.delivered, true);
  instance.conv.items.push(item("user", "first-log", timestamp + 3000, "first"));
  settlePending.call(instance);
  assert.deepEqual(messages(instance).map((row) => row.id), ["second", "answer", "first-log"]);
});

test("older card replies and failed sends keep their place and attachments", () => {
  const pending = { id: "pending-files", text: "files", at: timestamp + 1000, failed: "offline",
    replyTo: "question", files: ["report.txt"], paths: ["/tmp/image.png"], msg: { text: "files" } };
  const instance = chat([item("user", "first", timestamp, "first"),
    item("agent", "later", timestamp + 3000, "later")], [pending],
  [{ id: "card", text: "yes", at: timestamp + 500 }]);
  assert.deepEqual(messages(instance).map((row) => row.id),
    ["first", "rp:card", "rr:pending-files", "pending-files", "i:pending-files", "later"]);
  assert.equal(messages(instance).find((row) => row.id === pending.id).failed, "offline");
  assert.equal(instance.pending[0].msg.text, "files");
  instance.conv.items.push({ ...item("user", "card-answer", timestamp + 4000, "yes"), answer: true });
  settlePending.call(instance);
  assert.equal(instance.replied.length, 0);
});

test("equal times, untimestamped rows, and the real runtime queue remain ordered", () => {
  const pending = { id: "pending-same", text: "same", at: timestamp + 1000, delivered: true };
  const instance = chat([item("user", "first", timestamp + 1000, "first"),
    { kind: "tools", id: "within-turn", text: "tool" },
    item("agent", "later", timestamp + 2000, "later")], [pending], [],
  [{ id: "queue-same", text: "same", at: timestamp + 1000 },
    { id: "queue-other", text: "other", at: timestamp + 1500, images: 1 }]);
  assert.deepEqual(rows.call(instance).filter((row) => !["top", "day", "band", "end"].includes(row.kind))
    .map((row) => row.id), ["first", "within-turn", "pending-same", "qn:pending-same",
    "q:queue-other", "qn:q:queue-other", "later"]);
});

test("an unread or restarted session keeps the optimistic text and stable keys", () => {
  const pending = { id: "pending-old", text: "recover me", at: timestamp, late: true };
  const instance = chat([], [pending]);
  instance.start = null;
  assert.deepEqual(messages(instance).map((row) => row.id), ["pending-old"]);
  instance.conv.items = [item("user", "new", timestamp + 1000, "new")];
  assert.deepEqual(messages(instance).map((row) => row.id), ["pending-old", "new"]);
});
