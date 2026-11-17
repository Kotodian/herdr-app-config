import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, Button, Input, InputState, TextView } from "gpui-base";
import { theme, exec, props, home, appHome, shared, setShared, nextCommand, layout, openOverlay, closeOverlay } from "herdr";
import { tokens, G, T, quietTabs, quietLink, iconButton, section, controlInput } from "./ui.js";
import { commitLayout, walkLayout } from "./panels.js";

const MOD = "local-magpie", GATEWAY = "http://127.0.0.1:3425";
const money = n => n == null ? "—" : `$${Number(n).toFixed(2)}`;
const count = n => n == null ? "—" : Number(n).toLocaleString();
const compact = n => n == null ? "—" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n);
const PERIODS = [{ key: "today", label: "今日" }, { key: "7d", label: "7 天" }, { key: "30d", label: "30 天" }];
const CATEGORIES = [{ key: "skills", label: "技能" }, { key: "mcp", label: "MCP" }, { key: "subagents", label: "子代理" }, { key: "instructions", label: "指令" }];
const cleanError = e => String(e?.message ?? e).slice(0, 180);

async function request(path) {
  const r = await exec("/usr/bin/curl", ["--silent", "--show-error", "--fail", "--max-time", "8", `${GATEWAY}${path}`], { timeout: 10000 });
  if (r.code !== 0) throw new Error("无法连接本机 Magpie 网关，请确认 Magpie 已启动");
  return JSON.parse(r.stdout);
}

export default class Magpie extends View {
  init(_p, cx) {
    const p = props() ?? {};
    this.summary = p.role === "summary";
    this.page = p.page === "library" ? "library" : "usage";
    this.period = "today"; this.category = "skills"; this.snapshots = {};
    this.quotas = []; this.catalog = null; this.detail = null; this.detailSeq = 0;
    this.usageBusy = false; this.libraryBusy = false; this.up = null;
    this.handle = cx.focus_handle();
    if (this.summary) this.register();
    else {
      this.search = InputState.new({ placeholder: "名称、描述或 agent" });
      this.search.on("change", (_e, cx) => cx.notify());
      this.refreshLibrary(cx);
    }
    this.refreshUsage(cx);
    cx.timer.every(30000, cx => { this.refreshUsage(cx); if (!this.summary) this.refreshLibrary(cx); });
    cx.spawn(async cx => {
      for (;;) {
        const raw = await nextCommand();
        const command = String(raw).replace(/^local-magpie\./, "");
        if (this.summary && ["open", "usage", "library"].includes(command)) this.open(command === "library" ? "library" : "usage");
        if (!this.summary) {
          if (command === "refresh") { this.refreshUsage(cx); this.refreshLibrary(cx); }
          else if (command.startsWith("period-") && PERIODS.some(p => p.key === command.slice(7))) this.setPeriod(command.slice(7), cx);
          else if (command.startsWith("category-") && CATEGORIES.some(p => p.key === command.slice(9))) { this.page = "library"; this.category = command.slice(9); this.detail = null; cx.notify(); }
          else if (command.startsWith("skill:")) { this.page = "library"; this.category = "skills"; const item = this.catalog?.skills?.find(s => s.name === command.slice(6)); if (item) this.select(item, cx); }
          else if (command === "back") { this.detail = null; this.detailSeq++; cx.notify(); }
        }
      }
    });
  }

  register() {
    if (shared("layout") !== "kanso") return;
    const existing = Array.isArray(shared("kanso.panels")) ? shared("kanso.panels") : [];
    const entry = { id: "magpie", label: "Magpie", icon: "mods/local-magpie/magpie.svg", mod: MOD, props: { role: "panel" } };
    const list = existing.some(p => p.id === entry.id) ? existing.map(p => p.id === entry.id ? entry : p) : [...existing, entry];
    if (JSON.stringify(list) !== JSON.stringify(existing)) setShared("kanso.panels", list);
  }

  open(page) {
    if (shared("layout") === "shepherdr" && walkLayout(layout(), "panel-body")) {
      commitLayout({ panel: { id: "magpie", type: "block", content: { mod: MOD, props: { role: "panel", page, at: Date.now() } } } });
    } else openOverlay({ mod: MOD, kind: "dialog", width: 760, height: 680, props: { role: "details", page } });
  }

  close() {
    if (props()?.overlay) closeOverlay(props().overlay);
    else commitLayout({ panel: null });
  }

  setPeriod(period, cx) {
    this.period = period; this.page = "usage"; this.refreshUsage(cx); cx.notify();
  }

  refreshUsage(cx) {
    const period = this.summary ? "today" : this.period;
    if (this.usageBusy) { this.queuedPeriod = period; return; }
    this.usageBusy = true;
    cx.spawn(async cx => {
      try {
        this.snapshots[period] = await request(`/v1/magpie/usage?period=${period}`);
        this.up = true; this.usageError = null; this.updated = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch (e) { this.up = false; this.usageError = cleanError(e); }
      finally {
        this.usageBusy = false; cx.notify();
        const queued = this.queuedPeriod; this.queuedPeriod = null;
        if (queued && queued !== period) this.refreshUsage(cx);
      }
    });
    if (!this.summary && !this.quotaBusy && Date.now() - (this.quotaAt ?? 0) >= 60000) {
      this.quotaBusy = true;
      cx.spawn(async cx => {
        try { const r = await request("/v1/magpie/quotas"); this.quotas = r.data ?? []; this.quotaAt = Date.now(); this.quotaError = null; }
        catch (e) { this.quotaError = cleanError(e); }
        finally { this.quotaBusy = false; cx.notify(); }
      });
    }
  }

  refreshLibrary(cx) {
    if (this.libraryBusy) return;
    this.libraryBusy = true;
    cx.spawn(async cx => {
      try {
        const r = await exec("/usr/bin/python3", [`${appHome()}/mods/${MOD}/library.py`], { timeout: 15000 });
        const data = JSON.parse(r.stdout);
        if (r.code !== 0 || data.error) throw new Error(data.error || "读取资源库失败");
        this.catalog = data; this.libraryError = null;
      } catch (e) { this.libraryError = cleanError(e); }
      finally { this.libraryBusy = false; cx.notify(); }
    });
  }

  select(item, cx) {
    const kind = this.category, seq = ++this.detailSeq;
    this.detail = { ...item, kind, loading: kind !== "mcp" }; cx.notify();
    if (kind === "mcp") return;
    cx.spawn(async cx => {
      try {
        const r = await exec("/usr/bin/python3", [`${appHome()}/mods/${MOD}/library.py`, kind, item.name], { timeout: 15000 });
        const d = JSON.parse(r.stdout);
        if (r.code !== 0 || d.error) throw new Error(d.error || "读取内容失败");
        if (seq === this.detailSeq && this.detail) this.detail = { ...this.detail, loading: false, text: d.text, path: d.path };
      } catch (e) { if (seq === this.detailSeq && this.detail) this.detail = { ...this.detail, loading: false, error: cleanError(e) }; }
      cx.notify();
    });
  }

  note(text, c, error = false) {
    return div().text_size(T.body).text_color(error ? c.yellow : c.dim).child(text);
  }

  line(label, value, c, id = label) {
    return h_flex().id(`line-${id}`).w_full().items_center().gap(G.md).py(7).border_b(1).border_color(c.border)
      .child(div().flex_1().min_w(0).truncate().text_color(c.muted).child(label))
      .child(div().flex_none().text_size(T.value).text_right().child(value));
  }

  usage(c) {
    const d = this.snapshots[this.period];
    const body = v_flex().id("magpie-usage-scroll").flex_1().min_h(0).overflow_y_scrollbar().p(G.lg).gap(G.xl)
      .child(quietTabs("magpie-period", PERIODS, this.period, (period, cx) => this.setPeriod(period, cx), c))
      .when(Boolean(this.usageError), el => el.child(this.note(`${this.usageError}${d ? " · 显示上次结果" : ""}`, c, true)))
      .child(v_flex().gap(G.xs)
        .child(h_flex().items_end().justify_between().gap(G.sm)
          .child(div().text_size(T.page).child("用量费用"))
          .child(div().text_size(T.body).text_color(c.dim).child("USD")))
        .child(div().text_size(32).font_medium().child(money(d?.cost)))
        .child(this.note(d ? `${count(d.calls)} 次请求 · ${count(d.errors)} 次错误 · ${count(d.unpriced ?? 0)} 次未定价` : this.usageBusy ? "正在读取 Magpie…" : "暂无用量数据", c)))
      .when(Boolean(d), el => el.child(this.chart(d, c)))
      .child(v_flex().gap(G.xs).child(section(c, "Tokens"))
        .child(this.line("输入", compact(d?.input), c))
        .child(this.line("输出", compact(d?.output), c))
        .child(this.line("缓存读取", compact(d?.cache_read), c))
        .child(this.line("推理", compact(d?.reasoning), c)))
      .child(this.breakdown("Agents", d?.agents ?? [], c, "agent"))
      .child(this.breakdown("模型", d?.models ?? [], c, "model"))
      .child(this.quotaSection(c))
      .child(v_flex().gap(G.sm).child(section(c, "路由会话", `${d?.sessionCount ?? d?.sessions?.length ?? 0} 个`))
        .when(Boolean(d) && !d.sessions?.length, el => el.child(this.note("这个时段暂无路由会话", c)))
        .children((d?.sessions ?? []).slice(0, 30).map((s, i) => v_flex().id(`magpie-session-${i}`).gap(3).py(7).border_b(1).border_color(c.border)
          .child(h_flex().gap(G.sm).items_center()
            .child(div().flex_1().truncate().child(`${s.agent || "agent"} · ${s.id.slice(0, 8)}`))
            .child(div().text_right().child(money(s.cost))))
          .child(this.note(`${count(s.calls)} 次请求 · 输入 ${compact(s.input)} · 输出 ${compact(s.output)}`, c)))))
      .child(this.note("费用来自 Magpie 的模型计价记录；账号配额按各自窗口计算。", c));
    return body;
  }

  chart(d, c) {
    const series = d.series ?? [], peak = Math.max(0, ...series.map(s => Number(s.cost) || 0));
    return v_flex().gap(G.sm)
      .child(h_flex().h(56).w_full().items_end().gap(3).children(series.map((s, i) => div().id(`usage-bar-${i}`).flex_1().min_w(0)
        .h(peak ? Math.max(2, (Number(s.cost) || 0) / peak * 56) : 2).rounded(2).bg(Number(s.cost) ? c.muted : c.border)
        .tooltip(`${s.label} · ${money(s.cost)} · ${count(s.calls)} 次请求`))))
      .child(h_flex().justify_between().text_size(T.small).text_color(c.dim)
        .child(series[0]?.label ?? "").child("费用分布").child(series.at(-1)?.label ?? ""));
  }

  breakdown(title, rows, c, prefix) {
    return v_flex().gap(G.sm).child(section(c, title))
      .when(!rows.length, el => el.child(this.note(this.usageBusy ? "读取中…" : "暂无记录", c)))
      .children(rows.map((r, i) => v_flex().id(`${prefix}-${i}`).gap(3).py(7).border_b(1).border_color(c.border)
        .child(h_flex().items_center().gap(G.sm)
          .child(div().flex_1().min_w(0).truncate().child(r.name || r.model || r.id))
          .child(div().flex_none().text_right().child(money(r.cost))))
        .child(this.note(`${count(r.calls)} 次请求 · ${compact(r.input)} 输入 / ${compact(r.output)} 输出`, c))));
  }

  quotaSection(c) {
    return v_flex().gap(G.md).child(section(c, "账号配额", "实时窗口"))
      .when(Boolean(this.quotaError), el => el.child(this.note(this.quotaError, c, true)))
      .when(!this.quotas.length, el => el.child(this.note(this.quotaBusy ? "正在读取配额…" : "暂无可用配额", c)))
      .children(this.quotas.map((q, i) => v_flex().id(`quota-account-${i}`).gap(G.sm)
        .child(div().truncate().text_size(T.value).child(q.name || q.provider || "账号"))
        .when(!q.windows?.length, el => el.child(this.note("暂无用量窗口", c)))
        .children((q.windows ?? []).map((w, j) => {
          const used = Number.isFinite(Number(w.used)) ? Math.max(0, Math.min(100, Number(w.used))) : null;
          return v_flex().id(`quota-window-${i}-${j}`).gap(5)
            .child(h_flex().gap(G.sm).justify_between().text_size(T.body)
              .child(div().text_color(c.muted).child(w.name || "窗口"))
              .child(div().text_color(used >= 95 ? c.red : c.text).child(w.display || (used === null ? "未知" : `${used.toFixed(0)}% 已用`))))
            .child(div().h(3).w_full().rounded(2).bg(c.border)
              .when(used !== null, el => el.child(div().h(3).w(`${used}%`).rounded(2).bg(used >= 95 ? c.red : c.muted))))
            .when(Boolean(w.resetsAt), el => el.child(this.note(`重置 ${new Date(w.resetsAt).toLocaleString([], { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`, c)));
        }))));
  }

  library(c) {
    if (this.detail) return this.resource(c);
    const query = this.search.value().trim().toLowerCase();
    const all = this.catalog?.[this.category] ?? [];
    const rows = all.filter(s => `${s.name} ${s.description} ${(s.agents ?? []).join(" ")}`.toLowerCase().includes(query));
    return v_flex().flex_1().min_h(0)
      .child(v_flex().flex_none().px(G.lg).pt(G.lg).gap(G.md)
        .child(quietTabs("magpie-category", CATEGORIES.map(cat => ({ ...cat, label: `${cat.label} ${this.catalog?.[cat.key]?.length ?? ""}` })), this.category, (key, cx) => { this.category = key; this.detail = null; cx.notify(); }, c))
        .child(div().text_size(T.body).text_color(c.muted).child("搜索资源"))
        .child(controlInput(Input.new(this.search), c).w_full())
        .child(h_flex().justify_between().text_size(T.body).text_color(c.dim)
          .child(`${rows.length} / ${all.length} 项`).child("Magpie 本机资源库"))
        .when(Boolean(this.libraryError), el => el.child(this.note(this.libraryError, c, true))))
      .child(v_flex().id("magpie-resource-list").flex_1().min_h(0).overflow_y_scrollbar().p(G.lg).gap(G.xs)
        .when(!this.catalog && !this.libraryError, el => el.child(this.note("正在读取资源库…", c)))
        .when(Boolean(this.catalog) && !rows.length, el => el.child(this.note(query ? "没有匹配的资源" : "此分类暂无资源", c)))
        .children(rows.map((item, i) => Button.new(`magpie-resource-${this.category}-${i}`).w_full().py(G.md).px(G.sm).rounded(6).cursor_pointer()
          .accessibility_label(`查看 ${item.name}`).hover(s => s.bg(c.subtle)).focus(s => s.bg(c.selected))
          .on_click((_e, cx) => this.select(item, cx))
          .child(v_flex().w_full().min_w(0).gap(5)
            .child(h_flex().gap(G.sm).items_center()
              .child(div().flex_1().min_w(0).truncate().text_size(T.card).child(item.name))
              .child(svg("mods/kanso-chrome/icons/chevron-right.svg").size(13).text_color(c.dim)))
            .when(Boolean(item.description), el => el.child(div().w_full().truncate().text_size(T.body).text_color(c.muted).child(item.description)))
            .child(div().text_size(T.small).text_color(c.dim).child(`${item.available ? "" : "文件缺失 · "}${item.agents?.length ? item.agents.join(" · ") : "未分配 agent"}`))))));
  }

  resource(c) {
    const d = this.detail;
    const markdown = (d.text ?? "").replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
    return v_flex().flex_1().min_h(0)
      .child(h_flex().flex_none().px(G.lg).py(G.sm).gap(G.sm).items_center()
        .child(quietLink("magpie-resource-back", "‹ 返回资源库", cx => { this.detailSeq++; this.detail = null; cx.notify(); }, c)))
      .child(v_flex().id(`resource-preview-${d.kind}-${d.name}`).flex_1().min_h(0).overflow_y_scrollbar().p(G.lg).gap(G.lg)
        .child(div().text_size(T.page).child(d.name))
        .child(this.note(d.agents?.length ? `用于 ${d.agents.join(" · ")}` : "尚未分配给 agent", c))
        .when(Boolean(d.description), el => el.child(div().text_size(T.value).text_color(c.muted).child(d.description)))
        .when(Boolean(d.error), el => el.child(this.note(d.error, c, true)))
        .when(d.loading, el => el.child(this.note("正在读取内容…", c)))
        .when(Boolean(d.text), el => el.child(TextView.markdown(`magpie-doc-${d.kind}-${d.name}`, markdown).selectable().scrollable(false).w_full().text_size(12.5)))
        .when(d.kind === "mcp", el => el.child(this.note("此服务由 Magpie 统一管理；这里展示资源名称和 agent 分配。", c)))
        .when(Boolean(d.path), el => el.child(quietLink("magpie-reveal-skill", "在 Finder 中显示", cx => {
          cx.spawn(async cx => { try { const r = await exec("/usr/bin/open", ["-R", d.path]); if (r.code !== 0) throw new Error("无法在 Finder 中显示"); } catch (e) { if (this.detail) this.detail.error = cleanError(e); cx.notify(); } });
        }, c))));
  }

  render(cx) {
    const c = tokens(theme());
    if (this.summary) {
      const d = this.snapshots.today;
      return Button.new("magpie-summary").size_full().items_center().justify_center().cursor_pointer().rounded(6)
        .accessibility_label("打开 Magpie 用量和资源库").tooltip("Magpie · 用量与资源库")
        .hover(s => s.bg(c.subtle)).focus(s => s.bg(c.selected)).on_click(() => this.open("usage"))
        .child(h_flex().gap(6).items_center().text_size(11.5).text_color(c.muted)
          .child(svg("mods/local-magpie/magpie.svg").size(13))
          .child(`Magpie ${money(d?.cost)}`)
          .when(this.up === false, el => el.child(div().text_color(c.yellow).child("离线"))));
    }
    return v_flex().id("magpie-panel").size_full().min_w(0).min_h(0).bg(c.canvas).text_color(c.text).text_size(T.value).track_focus(this.handle)
      .on_key_down((_e, _cx) => {})
      .child(h_flex().flex_none().h(46).px(G.lg).gap(G.sm).items_center().border_b(1).border_color(c.border)
        .child(svg("mods/local-magpie/magpie.svg").size(16).text_color(c.muted))
        .child(div().flex_1().font_medium().text_size(T.card).child("Magpie"))
        .child(iconButton("magpie-refresh", "refresh", "刷新用量与资源库", cx => { this.refreshUsage(cx); this.refreshLibrary(cx); }, c, { disabled: this.usageBusy || this.libraryBusy }))
        .child(iconButton("magpie-close", "close", "关闭面板", () => this.close(), c)))
      .child(div().flex_none().px(G.lg).pt(G.md).pb(G.sm)
        .child(quietTabs("magpie-pages", [{ key: "usage", label: "Usage" }, { key: "library", label: "资源库" }], this.page, (page, cx) => { this.page = page; cx.notify(); }, c)))
      .child(this.page === "usage" ? this.usage(c) : this.library(c))
      .child(h_flex().flex_none().h(30).px(G.lg).gap(G.sm).items_center().border_t(1).border_color(c.border).text_size(T.small).text_color(c.dim)
        .child(div().flex_1().truncate().child(this.page === "library" ? "~/.config/magpie/library" : this.up ? `本机 Magpie · ${this.updated ?? ""} 更新` : this.up === false ? "Magpie 网关离线" : "连接 Magpie…"))
        .child(div().child("30s 刷新")));
  }
}
