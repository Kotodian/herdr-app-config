import { test, expect } from "bun:test";
import { sessionInbox } from "./session-inbox.js";

const coordinator = (address = "t1", extra = {}) => ({ address, state: "live", status: "idle", turn: 2,
  labels: { "herdr.role": "coordinator", "herdr.coordinator.space": "sp1" }, ...extra });

test("Inbox groups multiple notifications for one session and puts needs first", () => {
  const rows = sessionInbox({
    terminals: [coordinator("t1", { status: "blocked" }), coordinator("t2")],
    needs: [{ terminal: "t1", why: "等待授权", at: 10 }],
    spaces: [{ id: "sp1", name: "项目" }],
    agents: [{ address: "t1", tab_name: "Assistant" }],
  });
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({ terminal: "t1", reason: "等待授权", title: "Assistant", place: "项目", priority: 0 });
  expect(rows[1].reason).toBe("有新回复");
});

test("read replies and acknowledged alerts leave Inbox; unresolved needs stay", () => {
  const k = coordinator("t1", { status: "blocked", labels: { "herdr.role": "coordinator", "herdr.chat.read": "2",
    "herdr.alert": JSON.stringify({ id: "a1", title: "请求处理" }) } });
  expect(sessionInbox({ terminals: [k], alertRead: { t1: "a1" } })).toHaveLength(1);
  k.status = "idle";
  expect(sessionInbox({ terminals: [k], alertRead: { t1: "a1" } })).toEqual([]);
  expect(sessionInbox({ terminals: [k], alertRead: { t1: "old" } })[0].reason).toBe("请求处理");
});

test("muted Assistants stay quiet; task review stays visible without a live worker", () => {
  const rows = sessionInbox({ terminals: [coordinator()], notify: { spaces: { sp1: "Off" } },
    ready: [{ ref: "TASK-1", title: "待审核实现", space: "sp1", folder: "/repo", at: 1 }] });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ terminal: null, title: "待审核实现", reason: "等待人工审核" });
});

test("remote sessions retain their machine-qualified identity and worker read state", () => {
  const k = coordinator("vm/t1");
  const rows = sessionInbox({ terminals: [k], spaces: [{ id: "vm/sp1", name: "远端项目" }] });
  expect(rows[0]).toMatchObject({ terminal: "vm/t1", space: "vm/sp1", place: "远端项目" });
  const worker = { address: "t2", state: "live", status: "done", turn: 4, labels: { "herdr.task": "TASK-1" } };
  expect(sessionInbox({ terminals: [worker], seen: { t2: 4 } })).toEqual([]);
});
