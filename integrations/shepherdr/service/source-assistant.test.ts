import { beforeEach, expect, mock, test } from "bun:test";
import { fakeHerdr } from "./fake-herdr";
import { built, byId, element, fakeGpuiBase, fakeGpuiKit, handler } from "./fake-gpui";

const state = new Map<string, any>();
let active = "space-a";
let fetches = 0;
let resolveFile: (file: any) => void;
let rejectFile: (error: Error) => void;
const discarded: any[] = [];
mock.module("herdr", () => fakeHerdr({
  appHome: () => "/app",
  focused: () => ({ space: active }),
  theme: () => new Proxy({}, { get: () => "#000" }),
  shared: (key: string) => state.get(key),
  setShared: (key: string, value: any) => { state.set(key, value); },
}));
mock.module("gpui-kit", () => fakeGpuiKit());
mock.module("gpui-base", () => fakeGpuiBase({
  Button: { new: (id: string) => element("Button").id(id) }, Toggle: { new: () => element("Toggle") },
  TextView: { markdown: () => element("TextView") },
}));
mock.module("../mods/chat/attach.js", () => ({
  droppedFile: () => {
    fetches++;
    return new Promise((resolve, reject) => { resolveFile = resolve; rejectFile = reject; });
  },
  drop: (file: any) => discarded.push(file),
}));

const { SourceAssistant } = await import("../mods/chat/source-assistant.js");
const { default: Panel } = await import("../../../mods/local-tapd/main.js");
const { default: Issues } = await import("../../../mods/local-issues/main.js");
const tasks: Promise<any>[] = [];
const cx: any = { notify() {}, spawn(fn: any) { tasks.push(fn(cx)); } };
const url = "https://www.tapd.cn/12345678/bugtrace/bugs/view/1123456789000";
const snapshot = () => ({ path: "/app/data/chat-attach/snapshot.txt", source: "tapd", url, temp: true });
const chat = (space = "space-a") => ({
  thread: false, inner: false, role: "coordinator", phase: "ready", draftLoaded: true,
  draftFile: `draft-${space}`, files: [] as any[], dropBusy: 0, sourceClosed: false,
  slotRec: () => ({ space }), assistant: () => space,
  sourceSpace: () => ({ id: space, folder: "/repo", machine: null }),
  saved: 0, addFiles(files: any[]) { this.files.push(...files); },
  saveSoon() { this.saved++; },
});
function request(target: any, space = "space-a") {
  const presence = state.get(`context.assistant.${space}`);
  const value = { request: "request-one", target: presence?.target ?? target.token, draft: presence?.draft, source: "tapd",
    workspace: "12345678", bug: "1123456789000", status: "pending", at: Date.now() };
  state.set(`context.request.${space}`, value);
  return value;
}
const result = (space = "space-a") => state.get(`context.request.${space}`);

beforeEach(() => {
  state.clear(); tasks.length = 0; discarded.length = 0; active = "space-a"; fetches = 0;
  built.length = 0;
});

test("only a ready Assistant advertises a destination; workers and loading drafts do not", () => {
  for (const change of [{ thread: true }, { inner: true }, { role: null, assistant: () => null },
    { draftLoaded: false }, { phase: "finding" }, { sourceClosed: true }]) {
    new SourceAssistant(Object.assign(chat(), change)).tick(cx);
    expect(state.size).toBe(0);
  }
  new SourceAssistant(chat("space-b")).tick(cx);
  expect(state.size).toBe(0);
});

test("a targeted request adds one snapshot without changing the existing draft or sending", async () => {
  const owner = chat();
  owner.files.push({ path: "/existing.txt" });
  const inbox = new SourceAssistant(owner);
  inbox.tick(cx);
  request(inbox);
  inbox.tick(cx);
  inbox.tick(cx);
  expect(fetches).toBe(1);
  expect(owner.dropBusy).toBe(1);
  resolveFile(snapshot());
  await Promise.all(tasks);
  expect(owner.files.map(file => file.path)).toEqual(["/existing.txt", "/app/data/chat-attach/snapshot.txt"]);
  expect(owner.saved).toBe(1);
  expect(owner.dropBusy).toBe(0);
  expect(result().status).toBe("done");
  inbox.tick(cx);
  expect(fetches).toBe(1);
});

test("repeat requests for the same Bug do not add duplicate snapshots", async () => {
  const owner = chat();
  owner.files.push(snapshot());
  const inbox = new SourceAssistant(owner);
  inbox.tick(cx); request(inbox); inbox.tick(cx);
  await Promise.all(tasks);
  expect(fetches).toBe(0);
  expect(owner.files.length).toBe(1);
  expect(result().status).toBe("done");
});

test("a request for another view, another draft, or an expired request is refused", async () => {
  for (const change of [{ target: "old-view" }, { draft: "other-draft" }, { at: Date.now() - 15000 }]) {
    const owner = chat(), inbox = new SourceAssistant(owner);
    inbox.tick(cx);
    Object.assign(request(inbox), change);
    inbox.tick(cx);
    await Promise.all(tasks);
    expect(fetches).toBe(0);
    expect(owner.files.length).toBe(0);
  }
});

test("switching Space, closing the chat, or changing draft while reading discards the snapshot", async () => {
  for (const change of ["space", "close", "draft"]) {
    active = "space-a";
    const owner = chat(), inbox = new SourceAssistant(owner);
    inbox.tick(cx); request(inbox); inbox.tick(cx);
    if (change === "space") active = "space-b";
    if (change === "close") owner.sourceClosed = true;
    if (change === "draft") owner.draftFile = "another";
    resolveFile(snapshot());
    await tasks.at(-1);
    expect(owner.files.length).toBe(0);
    expect(owner.dropBusy).toBe(0);
    expect(result().status).toBe("error");
  }
  expect(discarded.length).toBe(3);
});

test("attachment capacity is checked before and after the asynchronous read", async () => {
  const owner = chat(), inbox = new SourceAssistant(owner);
  owner.files = Array.from({ length: 20 }, (_, index) => ({ path: `/${index}` }));
  inbox.tick(cx); request(inbox); inbox.tick(cx);
  await Promise.all(tasks);
  expect(fetches).toBe(0);
  expect(result().status).toBe("error");
  owner.files.pop();
  request(inbox); inbox.tick(cx);
  owner.files.push({ path: "/last" });
  resolveFile(snapshot()); await tasks.at(-1);
  expect(owner.files.length).toBe(20);
  expect(discarded.length).toBe(1);
  expect(result().status).toBe("error");
});

test("read failures are acknowledged and allow another request", async () => {
  const owner = chat(), inbox = new SourceAssistant(owner);
  inbox.tick(cx); request(inbox); inbox.tick(cx);
  rejectFile(new Error("TAPD unavailable")); await tasks.at(-1);
  expect(result()).toMatchObject({ status: "error", message: "TAPD unavailable" });
  expect(owner.dropBusy).toBe(0);
  request(inbox); inbox.tick(cx);
  resolveFile(snapshot()); await tasks.at(-1);
  expect(result().status).toBe("done");
});

const row = { workspace_id: "12345678", id: "1123456789000", title: "Synthetic Bug",
  status_label: "Open", project: "Synthetic project",
  dragPath: "/app/data/tapd-drag/12345678-1123456789000.tapd.json" };
const panel = () => {
  const source: any = new Panel();
  source.search = { value: () => "" };
  source.data = { bugs: [row], projects: [], complete: true };
  source.project = "all"; source.filter = "all";
  return source;
};

test("list and detail offer the same Assistant action and stop the card click", () => {
  const source = panel();
  source.selected = row;
  const colors = new Proxy({}, { get: () => "#000" });
  source.list(colors);
  source.details(colors);
  for (const id of [`tapd-assistant-${row.workspace_id}-${row.id}`, "tapd-detail-assistant"]) {
    const button = byId(id);
    expect(button).toBeDefined();
    let stopped = false, chosen: any;
    source.addToAssistant = (value: any) => { chosen = value; };
    handler(button, "on_click")?.({}, { stop_propagation() { stopped = true; } });
    expect(stopped).toBe(true);
    expect(chosen).toBe(row);
  }
});

test("sender requires the current Space's live Assistant, and suppresses repeat clicks", () => {
  const source = panel(), inbox = new SourceAssistant(chat());
  source.addToAssistant(row, cx);
  expect(source.assistantError).toContain("先打开");
  inbox.tick(cx);
  source.addToAssistant(row, cx);
  const first = result();
  expect(first).toMatchObject({ status: "pending", target: inbox.token, workspace: row.workspace_id, bug: row.id });
  source.addToAssistant(row, cx);
  expect(result()).toBe(first);
  expect(source.assistantError).toContain("请稍候");
  active = "space-b";
  source.addToAssistant(row, cx);
  expect(source.assistantError).toContain("先打开");
  expect(state.get("context.request.space-b")).toBeUndefined();
});

test("sender reports acknowledgement, missing receiver, and Space changes", () => {
  const source = panel(), inbox = new SourceAssistant(chat());
  inbox.tick(cx); source.addToAssistant(row, cx);
  Object.assign(result(), { status: "done", message: "Added to draft" });
  source.assistantResult(cx);
  expect(source.assistantMessage).toBe("Added to draft");
  expect(source.assistantPending).toBeNull();
  source.addToAssistant(row, cx);
  result().at -= 15000;
  source.assistantResult(cx); source.assistantResult(cx);
  expect(source.assistantError).toContain("未能接收");
  source.addToAssistant(row, cx);
  active = "space-b";
  source.assistantResult(cx); source.assistantResult(cx);
  expect(source.assistantError).toContain("Space 已切换");
});

test("leaving and returning during a read still cancels the old request", async () => {
  const owner = chat(), inbox = new SourceAssistant(owner);
  inbox.tick(cx); request(inbox); inbox.tick(cx);
  active = "space-b"; inbox.tick(cx);
  active = "space-a"; inbox.tick(cx);
  resolveFile(snapshot()); await tasks.at(-1);
  expect(owner.files).toHaveLength(0);
  expect(result().status).toBe("error");
});

test("GitHub list and detail use the same draft bridge and preserve ordinary card clicks", () => {
  const source: any = new Issues();
  const issue = { number: 7, title: "Synthetic Issue", url: "https://github.com/example/repo/issues/7",
    dragPath: "/app/data/github-issue-drag/example--repo-7.issue.json" };
  source.search = { value: () => "" };
  source.space = { id: "space-a" };
  source.data = { repo: "example/repo", issues: [issue] };
  const inbox = new SourceAssistant(chat()); inbox.tick(cx);
  source.render();
  const button = byId("issue-assistant-7");
  let stopped = false;
  handler(button, "on_click")?.({}, { ...cx, stop_propagation() { stopped = true; } });
  expect(stopped).toBe(true);
  expect(source.selected).toBeUndefined();
  expect(result()).toMatchObject({ source: "github", url: issue.url, target: inbox.token });
  source.selected = issue; source.render();
  expect(byId("issue-detail-assistant")).toBeDefined();
  active = "space-b";
  source.assistantResult(cx);
  expect(result().status).toBe("error");
  source.addToAssistant(issue, cx);
  expect(source.assistantError).toContain("当前 Space");
});

test("GitHub snapshots use the bound Space repository context, and deduplicate by source and URL", async () => {
  const owner = chat(), inbox = new SourceAssistant(owner);
  const issue = { ...snapshot(), source: "github", url: "https://github.com/example/repo/issues/7" };
  inbox.tick(cx);
  Object.assign(request(inbox), { source: "github", url: issue.url });
  inbox.tick(cx);
  resolveFile(issue); await tasks.at(-1);
  expect(owner.files).toEqual([issue]);
  Object.assign(request(inbox), { source: "github", url: issue.url });
  inbox.tick(cx); await tasks.at(-1);
  expect(fetches).toBe(1);
  expect(owner.files).toHaveLength(1);
  expect(result().status).toBe("done");
});

test("GitHub rejects a changed repository and a mismatched snapshot", async () => {
  for (const change of ["repository", "snapshot"]) {
    const owner = chat(), inbox = new SourceAssistant(owner);
    inbox.tick(cx);
    Object.assign(request(inbox), { source: "github", url: "https://github.com/example/repo/issues/7" });
    inbox.tick(cx);
    if (change === "repository") owner.sourceSpace = () => ({ id: "space-a", folder: "/other", machine: null });
    resolveFile(change === "repository" ? { ...snapshot(), source: "github", url: "https://github.com/example/repo/issues/7" } : snapshot());
    await tasks.at(-1);
    expect(owner.files).toHaveLength(0);
    expect(result().status).toBe("error");
  }
});

test("an old Assistant instance cannot clear the new instance's registration", () => {
  const first = new SourceAssistant(chat()), next = new SourceAssistant(chat());
  first.tick(cx); next.tick(cx); first.close();
  expect(state.get("context.assistant.space-a").target).toBe(next.token);
});
