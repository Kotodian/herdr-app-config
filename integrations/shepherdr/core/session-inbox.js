import { readTurn, machineOf } from "./spaces.js";
import { spaceOfTerminal, spaceLevel } from "./notify.js";

// Sessions with something to read or handle. Derive them from the same notification
// state as Tasks and the sidebar; no second polling engine or stored notification list.
export function sessionInbox({ terminals = [], agents = [], spaces = [], needs = [], ready = [], seen = {}, alertRead = {}, dismissed = {}, notify = {} }) {
  const ts = new Map(terminals.map((k) => [k.address, k]));
  const as = new Map(agents.map((a) => [a.address, a]));
  const rows = new Map();
  const add = (address, reason, priority, at = 0, task = null, event = null) => {
    const k = ts.get(address), agent = as.get(address);
    const spaceId = spaceOfTerminal(k) ?? task?.space ?? agent?.space;
    const space = spaces.find((s) => s.id === spaceId);
    if (!address && !task) return;
    const key = address || `task:${task.machine ?? ""}:${task.folder}:${task.ref}`;
    const notification = JSON.stringify([priority, reason, event === null ? at : 0,
      event ?? (task ? [task.machine ?? null, task.folder, task.ref] : null)]);
    if (Array.isArray(dismissed[key]) && dismissed[key].includes(notification)) return;
    const old = rows.get(key);
    const notifications = [...(old?.notifications ?? []), notification];
    if (old && old.priority <= priority) { old.notifications = notifications; return; }
    rows.set(key, { key, terminal: address || null, task, space: spaceId, tab: agent?.tab ?? task?.tab ?? null,
      title: task?.title || agent?.tab_name || k?.name || k?.title || k?.program?.name || address,
      place: space?.name || task?.name || machineOf(address), reason, priority, at, notifications });
  };
  for (const x of needs) {
    const address = x.terminal || x.live?.[0];
    // Tasks retain their visibility; ordinary sessions respect Notify: Off.
    const k = ts.get(address);
    if (!x.ref && spaceLevel(notify, spaceOfTerminal(k)) === "Off") continue;
    if (address || x.ref) add(address, x.why || x.attention || "需要你处理", 0, x.at, x.ref ? x : null);
  }
  for (const x of ready) add(x.live?.[0], "等待人工审核", 1, x.at, x);
  for (const k of terminals) {
    if (k.state !== "live") continue;
    const space = spaceOfTerminal(k);
    if (!k.labels?.["herdr.task"] && spaceLevel(notify, space) === "Off") continue;
    if (k.status === "blocked") add(k.address, "需要你处理", 0, k.status_ms ?? 0);
    const read = Math.max(readTurn(k, seen), seen[k.address] ?? 0);
    const status = as.get(k.address)?.status ?? k.status;
    if ((k.turn ?? 0) > read && (k.labels?.["herdr.role"] === "coordinator" || status === "done")) {
      add(k.address, "有新回复", 2, k.status_ms ?? 0, null, k.turn);
    }
    let alert;
    try { alert = JSON.parse(k.labels?.["herdr.alert"] || "null"); } catch {}
    if (alert?.id && alertRead[k.address] !== alert.id) add(k.address, String(alert.title || "有新通知"), 0, alert.at ?? 0, null, alert.id);
  }
  return [...rows.values()].sort((a, b) => a.priority - b.priority || b.at - a.at || a.key.localeCompare(b.key));
}
