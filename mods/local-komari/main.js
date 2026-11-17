import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, Button, Input, InputState } from "gpui-base";
import { theme, exec, props, shared, setShared, nextCommand, layout, run } from "herdr";
import { tokens, G, T, quietTabs, quietLink, iconButton, section, controlInput } from "./ui.js";
import { commitLayout, walkLayout, panelIsOpen } from "./panels.js";

const MOD = "local-komari", BASE = "https://mo.linqiankai.top", SNAP = "local.komari.snapshot";
const safe = e => String(e?.message ?? e).slice(0, 160);
const num = n => Number.isFinite(Number(n)) ? Number(n) : 0;
const percent = (n, total) => num(total) > 0 ? num(n) / num(total) * 100 : null;
const pct = n => n == null || !Number.isFinite(n) ? "—" : `${n.toFixed(1)}%`;
const bytes = n => {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  let value = Number(n), i = 0; const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  while (Math.abs(value) >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};
const rate = n => n == null ? "—" : `${bytes(n)}/s`;
const uptime = n => n == null ? "—" : `${Math.floor(n / 86400)} 天 ${Math.floor(n % 86400 / 3600)} 小时`;
const date = value => !value || Number.isNaN(new Date(value).getTime()) ? "—" : new Date(value).toLocaleString([], { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

async function request(path, rpc = null) {
  const args = ["-fsSL", "--connect-timeout", "5", "--max-time", "8"];
  if (rpc) args.push("-H", "Content-Type: application/json", "--data", JSON.stringify({ jsonrpc: "2.0", id: 1, method: rpc, params: {} }));
  args.push(BASE + path);
  const r = await exec("/usr/bin/curl", args, { timeout: 10000 });
  if (r.code !== 0) throw new Error(`Komari 请求失败（${r.code}），请检查站点连接`);
  const body = JSON.parse(r.stdout);
  if (body.error) throw new Error(body.error.message || "Komari RPC 错误");
  if (!rpc && body.status !== "success") throw new Error(body.message || "Komari 接口返回错误");
  return rpc ? body.result : body.data;
}

export default class Komari extends View {
  init(_p, cx) {
    this.entry = props()?.role === "entry";
    this.handle = cx.focus_handle(); this.filter = "all"; this.selected = null; this.history = null;
    if (this.entry) { this.register(); this.collect(cx); cx.timer.every(10000, cx => this.collect(cx)); }
    else {
      this.search = InputState.new({ placeholder: "节点名称、分组、地区" });
      this.search.on("change", (_e, cx) => cx.notify());
      this.collect(cx);
      cx.timer.every(10000, cx => this.collect(cx));
      cx.timer.every(1000, cx => cx.notify());
      cx.timer.every(30000, cx => { if (this.selected) this.loadHistory(cx); });
    }
    cx.spawn(async cx => {
      for (;;) {
        const command = String(await nextCommand()).replace(/^local-komari\./, "");
        if (this.entry && command === "open") this.open();
        if (this.entry && command === "refresh") this.collect(cx, true);
        if (!this.entry && command === "refresh") this.loadHistory(cx);
        if (!this.entry && command.startsWith("node:")) { this.selected = command.slice(5); this.history = null; this.loadHistory(cx); cx.notify(); }
        if (!this.entry && command === "back") { this.selected = null; this.history = null; this.historyFor = null; cx.notify(); }
      }
    });
  }

  register() {
    const current = Array.isArray(shared("kanso.panels")) ? shared("kanso.panels") : [];
    const entry = { id: "komari", label: "Komari", icon: "mods/kanso-chrome/icons/server.svg", mod: MOD, props: { role: "panel" } };
    const list = current.some(p => p.id === "komari") ? current.map(p => p.id === "komari" ? entry : p) : [...current, entry];
    if (JSON.stringify(list) !== JSON.stringify(current)) setShared("kanso.panels", list);
  }

  open() {
    const body = walkLayout(layout(), "panel-body");
    if (!body) return;
    const on = panelIsOpen("komari");
    commitLayout({ panel: on ? null : { id: "komari", type: "block", content: { mod: MOD, props: { role: "panel" } } } });
  }

  collect(cx, force = false) {
    if (this.busy) return;
    this.busy = true;
    cx.spawn(async cx => {
      const previous = shared(SNAP);
      try {
        // One collector for the status entry and side panel; no administrator session is needed.
        const nodes = !force && previous?.nodes?.length && Date.now() - (this.nodesAt ?? 0) < 60000
          ? previous.nodes : await request("/api/nodes");
        if (nodes !== previous?.nodes) this.nodesAt = Date.now();
        const statuses = await request("/api/rpc2", "common:getNodesLatestStatus");
        if (!Array.isArray(nodes) || !statuses || typeof statuses !== "object") throw new Error("Komari 数据格式不匹配");
        const visible = nodes.filter(n => !n.hidden);
        const allowed = Object.fromEntries(visible.filter(n => statuses[n.uuid]).map(n => [n.uuid, statuses[n.uuid]]));
        setShared(SNAP, { nodes: visible, statuses: allowed, at: Date.now(), error: null });
      } catch (e) {
        setShared(SNAP, { ...(previous ?? { nodes: [], statuses: {}, at: null }), error: safe(e), failedAt: Date.now() });
      } finally { this.busy = false; cx.notify(); }
    });
  }

  loadHistory(cx) {
    const uuid = this.selected;
    if (!uuid || this.historyBusy === uuid) return;
    this.historyBusy = uuid;
    cx.spawn(async cx => {
      try {
        const rows = await request(`/api/recent/${encodeURIComponent(uuid)}`);
        if (!Array.isArray(rows)) throw new Error("最近记录格式不匹配");
        if (this.selected === uuid) {
          this.history = rows.toSorted((a, b) => String(a.updated_at).localeCompare(String(b.updated_at))).slice(-60);
          this.historyFor = uuid; this.historyError = null;
        }
      } catch (e) { if (this.selected === uuid) this.historyError = safe(e); }
      finally { if (this.historyBusy === uuid) this.historyBusy = null; cx.notify(); }
    });
  }

  note(text, c, error = false) { return div().text_size(T.body).text_color(error ? c.yellow : c.dim).child(text); }
  row(label, value, c) {
    return h_flex().w_full().items_center().gap(G.md).py(7).border_b(1).border_color(c.border)
      .child(div().flex_none().text_color(c.muted).child(label))
      .child(div().flex_1().min_w(0).text_right().child(value));
  }
  meter(label, value, c, text = null) {
    const high = value != null && value >= 90;
    return h_flex().w_full().items_center().gap(G.sm).h(20)
      .child(div().w(34).flex_none().text_size(T.small).text_color(c.dim).child(label))
      .child(div().flex_1().min_w(0).h(3).rounded(2).bg(c.border)
        .when(value != null, el => el.child(div().h(3).w(`${Math.max(0, Math.min(100, value))}%`).rounded(2).bg(high ? c.yellow : c.muted))))
      .child(div().w(52).flex_none().text_right().text_size(T.body).text_color(high ? c.yellow : c.text).child(text ?? pct(value)));
  }

  list(data, c, stale) {
    const nodes = data?.nodes ?? [], statuses = data?.statuses ?? {};
    const online = nodes.filter(n => statuses[n.uuid]?.online === true).length;
    const query = this.search.value().trim().toLowerCase();
    const shown = nodes.filter(n => `${n.name} ${n.group} ${n.region} ${n.tags}`.toLowerCase().includes(query))
      .filter(n => this.filter === "all" || (this.filter === "online" ? statuses[n.uuid]?.online === true : statuses[n.uuid]?.online !== true));
    const active = nodes.map(n => statuses[n.uuid]).filter(s => s?.online);
    return v_flex().flex_1().min_h(0)
      .child(v_flex().flex_none().p(G.lg).gap(G.md)
        .child(h_flex().items_end().gap(G.sm)
          .child(div().text_size(28).font_medium().child(stale ? "—" : String(online)))
          .child(div().pb(3).text_color(c.dim).child(`/ ${nodes.length} 在线`)))
        .child(this.note(stale ? "等待最新状态，下面保留上次采样" : `↓ ${rate(active.reduce((s, n) => s + num(n.net_in), 0))}    ↑ ${rate(active.reduce((s, n) => s + num(n.net_out), 0))}`, c, stale))
        .child(quietTabs("komari-filter", [{ key: "all", label: "全部" }, { key: "online", label: "在线" }, { key: "offline", label: "离线 / 未知" }], this.filter, (key, cx) => { this.filter = key; cx.notify(); }, c))
        .child(div().text_size(T.body).text_color(c.muted).child("搜索节点"))
        .child(controlInput(Input.new(this.search), c).w_full()))
      .child(v_flex().id("komari-node-list").flex_1().min_h(0).overflow_y_scrollbar().px(G.lg).pb(G.lg).gap(G.sm)
        .when(!data, el => el.child(this.note("正在连接 Komari…", c)))
        .when(Boolean(data) && !shown.length, el => el.child(this.note(query ? "没有匹配的节点" : "暂无符合条件的节点", c)))
        .children(shown.map(n => {
          const s = statuses[n.uuid], on = s?.online === true;
          return Button.new(`komari-node-${n.uuid}`).w_full().p(G.md).rounded(6).cursor_pointer()
            .accessibility_label(`查看 ${n.name}`).hover(el => el.bg(c.subtle)).focus(el => el.bg(c.selected))
            .on_click((_e, cx) => { this.selected = n.uuid; this.history = null; this.historyError = null; this.loadHistory(cx); cx.notify(); })
            .child(v_flex().w_full().min_w(0).gap(G.sm)
              .child(h_flex().items_center().gap(G.sm)
                .child(div().flex_1().min_w(0).truncate().text_size(T.card).child(`${n.region || ""} ${n.name}`.trim()))
                .child(div().text_size(T.small).text_color(stale ? c.dim : on ? c.green : s ? c.yellow : c.dim).child(stale ? "缓存" : on ? "在线" : s ? "离线" : "未知"))
                .child(svg("mods/kanso-chrome/icons/chevron-right.svg").size(13).text_color(c.dim)))
              .child(this.note(n.group || "未分组", c))
              .child(this.meter("CPU", s ? num(s.cpu) : null, c))
              .child(this.meter("内存", s ? percent(s.ram, s.ram_total ?? n.mem_total) : null, c))
              .child(this.meter("磁盘", s ? percent(s.disk, s.disk_total ?? n.disk_total) : null, c))
              .child(this.note(`↓ ${on && !stale ? rate(s.net_in) : "—"}    ↑ ${on && !stale ? rate(s.net_out) : "—"}`, c)))
            .border_b(1).border_color(c.border);
        })));
  }

  detail(data, c, stale) {
    const n = data?.nodes?.find(n => n.uuid === this.selected), s = data?.statuses?.[this.selected];
    if (!n) return div().p(G.lg).child(this.note("此节点已不在公开列表中", c));
    const recent = this.historyFor === n.uuid ? this.history : null;
    return v_flex().id(`komari-detail-${n.uuid}`).flex_1().min_h(0).overflow_y_scrollbar().p(G.lg).gap(G.xl)
      .child(v_flex().gap(G.sm)
        .child(div().text_size(T.page).child(`${n.region || ""} ${n.name}`.trim()))
        .child(this.note(`${n.group || "未分组"} · ${stale ? "缓存数据" : s?.online ? "在线" : s ? "离线" : "状态未知"}`, c)))
      .child(v_flex().gap(G.sm).child(section(c, "实时负载", date(s?.time)))
        .child(this.meter("CPU", s ? num(s.cpu) : null, c))
        .child(this.meter("内存", s ? percent(s.ram, s.ram_total ?? n.mem_total) : null, c))
        .child(this.note(`${bytes(s?.ram)} / ${bytes(s?.ram_total ?? n.mem_total)}`, c))
        .child(this.meter("磁盘", s ? percent(s.disk, s.disk_total ?? n.disk_total) : null, c))
        .child(this.note(`${bytes(s?.disk)} / ${bytes(s?.disk_total ?? n.disk_total)}`, c))
        .child(this.row("Swap", s ? `${bytes(s.swap)} / ${bytes(s.swap_total)}` : "—", c))
        .child(this.row("运行时间", uptime(s?.uptime), c))
        .child(this.row("Load 1 / 5 / 15", s ? `${num(s.load).toFixed(2)} / ${num(s.load5).toFixed(2)} / ${num(s.load15).toFixed(2)}` : "—", c)))
      .child(v_flex().gap(G.sm).child(section(c, "最近 CPU", recent ? `${recent.length} 个采样` : ""))
        .when(Boolean(this.historyError), el => el.child(this.note(this.historyError, c, true)))
        .when(!recent?.length && !this.historyError, el => el.child(this.note(this.historyBusy ? "读取最近记录…" : "暂无最近采样", c)))
        .when(Boolean(recent?.length), el => el.child(this.historyChart(recent, c))))
      .child(v_flex().gap(G.sm).child(section(c, "网络"))
        .child(this.row("下载", stale || !s?.online ? "—" : rate(s.net_in), c))
        .child(this.row("上传", stale || !s?.online ? "—" : rate(s.net_out), c))
        .child(this.row("累计下载", bytes(s?.net_total_down), c))
        .child(this.row("累计上传", bytes(s?.net_total_up), c))
        .child(this.row("流量限额", num(n.traffic_limit) ? bytes(n.traffic_limit) : "未设置", c))
        .child(this.row("TCP / UDP", s ? `${num(s.connections)} / ${num(s.connections_udp)}` : "—", c)))
      .child(v_flex().gap(G.sm).child(section(c, "延迟"))
        .when(!Object.keys(s?.ping ?? {}).length, el => el.child(this.note("暂无 Ping 结果", c)))
        .children(Object.entries(s?.ping ?? {}).map(([id, p]) => v_flex().id(`komari-ping-${id}`).gap(G.xs)
          .child(this.row(p.name || id, p.latest != null && p.latest >= 0 ? `${p.latest.toFixed(0)} ms` : "无响应", c))
          .child(this.note(`平均 ${p.avg != null ? `${num(p.avg).toFixed(0)} ms` : "—"} · 丢包 ${p.loss != null ? `${num(p.loss).toFixed(1)}%` : "—"}`, c)))))
      .child(v_flex().gap(G.sm).child(section(c, "节点资料"))
        .child(this.row("系统", n.os || "—", c))
        .child(this.row("架构 / 核心", `${n.arch || "—"} / ${n.cpu_cores ?? "—"}`, c))
        .child(this.note(n.cpu_name || "", c))
        .child(this.row("到期", n.expired_at ? new Date(n.expired_at).toLocaleDateString() : "—", c))
        .child(this.row("账单", n.price == null ? "未设置" : `${n.currency || ""}${n.price} / ${n.billing_cycle} 天`, c))
        .child(this.note(n.tags ? `标签 · ${n.tags.split(";").join(" · ")}` : "无标签", c)));
  }

  historyChart(rows, c) {
    const peak = Math.max(1, ...rows.map(r => num(r.cpu?.usage)));
    return v_flex().gap(G.sm)
      .child(h_flex().h(60).w_full().items_end().gap(3).children(rows.map((r, i) => div().id(`komari-history-${i}`).flex_1().min_w(0)
        .h(Math.max(2, num(r.cpu?.usage) / peak * 60)).rounded(2).bg(c.muted)
        .tooltip(`${date(r.updated_at)} · CPU ${pct(num(r.cpu?.usage))}`))))
      .child(h_flex().justify_between().text_size(T.small).text_color(c.dim)
        .child(date(rows[0]?.updated_at)).child(`峰值 ${pct(peak)}`).child(date(rows.at(-1)?.updated_at)));
  }

  render() {
    const c = tokens(theme()), data = shared(SNAP);
    const stale = Boolean(data?.error) || !data?.at || Date.now() - data.at > 30000;
    const nodes = data?.nodes ?? [], on = nodes.filter(n => data.statuses?.[n.uuid]?.online === true).length;
    if (this.entry) return Button.new("komari-entry").size_full().items_center().justify_center().rounded(6).cursor_pointer()
      .accessibility_label("打开 Komari 探针面板").tooltip("Komari · 服务器监控").hover(s => s.bg(c.subtle)).focus(s => s.bg(c.selected))
      .on_click(() => this.open()).child(h_flex().gap(6).items_center().text_size(T.body).text_color(c.muted)
        .child(svg("mods/kanso-chrome/icons/server.svg").size(13)).child(stale ? "Komari —" : `Komari ${on}/${nodes.length}`));
    return v_flex().id("komari-panel").size_full().min_w(0).min_h(0).bg(c.canvas).text_color(c.text).text_size(T.value).track_focus(this.handle)
      .child(h_flex().flex_none().h(46).px(G.lg).gap(G.sm).items_center().border_b(1).border_color(c.border)
        .when(Boolean(this.selected), el => el.child(iconButton("komari-back", "chevron-left", "返回节点列表", cx => { this.selected = null; this.history = null; this.historyFor = null; cx.notify(); }, c)))
        .child(svg("mods/kanso-chrome/icons/server.svg").size(16).text_color(c.muted))
        .child(div().flex_1().text_size(T.card).font_medium().child("Komari"))
        .child(iconButton("komari-refresh", "refresh", "刷新探针", () => run("local-komari.refresh"), c))
        .child(iconButton("komari-close", "close", "关闭面板", () => commitLayout({ panel: null }), c)))
      .when(Boolean(data?.error), el => el.child(div().flex_none().px(G.lg).py(G.sm).child(this.note(data.error, c, true))))
      .child(this.selected ? this.detail(data, c, stale) : this.list(data, c, stale))
      .child(h_flex().flex_none().h(30).px(G.lg).gap(G.sm).items_center().border_t(1).border_color(c.border).text_size(T.small).text_color(c.dim)
        .child(div().flex_1().truncate().child("mo.linqiankai.top"))
        .child(div().child(data?.at ? `${date(data.at)} · ${stale ? "待更新" : "10s 刷新"}` : "连接中…")));
  }
}
