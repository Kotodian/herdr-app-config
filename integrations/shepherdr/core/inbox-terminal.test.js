import { expect, mock, test } from "bun:test";

let currentFocus;
let taskMode = "tasks-thread-chat";
let livePanes = [];
let liveTerminals = [];
const commands = [];
const state = new Map();
const writes = [];
const ask = "t1.100.123";

mock.module("herdr", () => ({
  agents: () => [],
  appHome: () => "/app",
  exec: async (_program, args) => ({
    stdout: args[1].includes("kill -0") ? `${ask}.json\n` : args[1].includes('"turn_id"') ? `${ask}\n` : "",
  }),
  focused: () => currentFocus,
  home: () => "/home",
  layout: () => ({ id: "tasks-thread", children: [{ id: "tasks-thread-body", active: taskMode }] }),
  notify: () => {},
  openOverlay: () => {},
  panes: () => livePanes,
  playSound: () => {},
  readTextFile: async () => null,
  run: (name, args) => commands.push([name, args]),
  setShared: (key, value) => state.set(key, value),
  settings: () => ({}),
  shared: (key) => state.get(key),
  spaces: () => [],
  terminals: () => liveTerminals,
  theme: () => ({}),
  watchFolder: () => new Promise(() => {}),
  writeTextFile: async (path, text) => { writes.push([path, text]); },
}));
mock.module("gpui-kit", () => ({ div: () => {}, svg: () => {} }));
mock.module("gpui-base", () => ({ h_flex: () => {} }));

const { startInbox, toAlert } = await import("../mods/spaces-chat/inbox.js");

test("Inbox opens the visible terminal pane for a task waiting for input", () => {
  liveTerminals = [{ address: "t1", state: "live", status: "blocked", labels: { "herdr.task": "repo#1" } }];
  livePanes = [{ pane: "p1", tab: "tab1", terminal: "t1" }];
  toAlert({ terminal: "t1" });
  expect(commands.splice(0)).toEqual([
    ["tab.select", { id: "tab1" }],
    ["pane.focus", { pane: "p1" }],
  ]);
});

test("a focused task terminal releases the Codex hook to show the native prompt", async () => {
  currentFocus = { terminal: "t1", tab: "tab2", pane: null, shown: null };
  livePanes = [];
  let done;
  const firstPoll = new Promise((resolve) => { done = resolve; });
  startInbox({
    spawn: (fn) => { void fn({ sleep: () => { done(); return new Promise(() => {}); } }); },
    timer: { every: () => {} },
  });
  await firstPoll;
  expect(writes).toEqual([[`/app/data/chat-asks/ans/${ask}.json`, ""]]);
  expect(state.get("inbox.asks")).toEqual([]);
});

test("Inbox retargets the open task terminal to the worker awaiting permission", () => {
  taskMode = "tasks-thread-term";
  livePanes = [];
  liveTerminals = [{ address: "t2", state: "live", status: "working", labels: { "herdr.task": "repo#2" } }];
  state.set("inbox.asks", [{ id: "t2.200.456", terminal: "t2" }]);
  toAlert({ terminal: "t2" });
  expect(state.get("tasks.thread")).toMatchObject({ terminal: "t2" });
  expect(state.get("tasks.thread.termreq")).toMatchObject({ terminal: "t2" });
});
