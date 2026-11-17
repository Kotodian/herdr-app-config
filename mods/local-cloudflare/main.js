import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, Button, Input, InputState, Textarea, TextareaState } from "gpui-base";
import { theme, exec, appHome, props, shared, setShared, nextCommand, layout } from "herdr";
import { tokens, G, T, quietTabs, quietLink, iconButton, section, controlInput, toggleSwitch } from "./ui.js";
import { commitLayout, walkLayout, panelIsOpen } from "./panels.js";
const MOD = "local-cloudflare", ICON = "mods/local-cloudflare/icon.svg";
const TYPES = ["A", "AAAA", "CNAME", "TXT", "MX", "NS"];
const ttlText = n => Number(n) === 1 ? "自动" : `${n} 秒`;

export default class Cloudflare extends View {
  init(_p, cx) {
    this.entry = props()?.role === "entry";
    this.zones = []; this.records = []; this.zone = null; this.loadedZone = null; this.error = null; this.message = null;
    this.busy = false; this.editing = false; this.review = null; this.record = null; this.kind = "A"; this.proxy = false;
    this.handle = cx.focus_handle();
    if (this.entry) this.register();
    else {
      this.search = InputState.new({ placeholder: "搜索名称、类型或内容" });
      this.name = InputState.new({ placeholder: "@ 或完整子域名" });
      this.content = TextareaState.new({ placeholder: "IP 地址、目标域名或文本", rows: 3 });
      this.ttl = InputState.new({ value: "1" }); this.priority = InputState.new({ value: "10" });
      for (const input of [this.search, this.name, this.content, this.ttl, this.priority]) input.on("change", (_e, cx) => cx.notify());
      this.load(cx, true);
    }
    cx.spawn(async cx => {
      for (;;) {
        const cmd = String(await nextCommand()).replace(/^local-cloudflare\./, "");
        if (this.entry && cmd === "open") this.open();
        if (!this.entry && !this.busy && cmd === "refresh" && !this.editing) this.load(cx);
        if (!this.entry && !this.busy && cmd === "new" && this.loadedZone === this.zone?.id) this.edit(null, cx);
        if (!this.entry && !this.busy && cmd.startsWith("edit:")) {
          const r = this.records.find(r => r.id === cmd.slice(5)); if (r) this.edit(r, cx);
        }
        if (!this.entry && !this.busy && this.editing && cmd === "review" && TYPES.includes(this.kind)) this.prepare(cx);
        if (!this.entry && !this.busy && cmd === "back") { this.editing = false; this.review = null; this.error = null; cx.notify(); }
      }
    });
  }
  register() {
    const old = Array.isArray(shared("kanso.panels")) ? shared("kanso.panels") : [];
    const entry = { id: "cloudflare", label: "Cloudflare", icon: ICON, mod: MOD, props: { role: "panel" } };
    const list = old.some(p => p.id === entry.id) ? old.map(p => p.id === entry.id ? entry : p) : [...old, entry];
    if (JSON.stringify(old) !== JSON.stringify(list)) setShared("kanso.panels", list);
  }
  open() {
    const body = walkLayout(layout(), "panel-body");
    if (body) commitLayout({ panel: panelIsOpen("cloudflare") ? null : { id: "cloudflare", type: "block", content: { mod: MOD, props: { role: "panel" } } } });
  }
  async request(args) {
    const r = await exec("python3", [`${appHome()}/mods/${MOD}/cloudflare.py`, JSON.stringify(args)], { timeout: 90000 });
    if (r.code !== 0) throw new Error("DNS 服务未能完成请求，请刷新确认状态");
    let result;
    try { result = JSON.parse(r.stdout); } catch (_) { throw new Error("DNS 服务返回格式错误，请刷新确认状态"); }
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }
  load(cx, zones = false) {
    if (this.busy) return;
    this.busy = true; this.error = null; cx.notify();
    cx.spawn(async cx => {
      try {
        if (zones || !this.zones.length) {
          this.zones = await this.request({ action: "zones" });
          this.zone = this.zones.find(z => z.id === this.zone?.id) ?? this.zones[0] ?? null;
        }
        if (this.zone) {
          const rows = await this.request({ action: "records", zone: this.zone.id });
          this.records = rows; this.loadedZone = this.zone.id; this.at = Date.now();
        }
      } catch (e) { this.error = String(e.message ?? e); }
      finally { this.busy = false; cx.notify(); }
    });
  }
  edit(record, cx) {
    this.record = record; this.kind = record?.type ?? "A"; this.proxy = record?.proxied === true;
    this.name.set_value(record?.name ?? "@"); this.content.set_value(record?.content ?? "");
    this.ttl.set_value(String(record?.ttl ?? 1)); this.priority.set_value(String(record?.priority ?? 10));
    this.editing = true; this.review = null; this.error = null; this.message = null; cx.notify();
  }
  prepare(cx) {
    const name = this.name.value().trim(), content = this.content.value();
    const ttl = Number(this.ttl.value()), priority = Number(this.priority.value());
    if (!name || !content || !Number.isInteger(ttl) || (ttl !== 1 && (ttl < 60 || ttl > 86400))) {
      this.error = "请填写名称和内容；TTL 为 1（自动）或 60–86400 秒"; cx.notify(); return;
    }
    if (this.kind === "MX" && (!Number.isInteger(priority) || priority < 0 || priority > 65535)) { this.error = "MX 优先级应为 0–65535"; cx.notify(); return; }
    this.review = { type: this.kind, name, content, ttl: this.proxy ? 1 : ttl, proxied: ["A", "AAAA", "CNAME"].includes(this.kind) && this.proxy };
    if (this.kind === "MX") this.review.priority = priority;
    this.error = null; cx.notify();
  }
  save(cx) {
    if (!this.review || this.busy) return;
    const body = this.review, old = this.record, zone = this.zone;
    this.busy = true; this.error = null; cx.notify();
    cx.spawn(async cx => {
      try {
        const saved = await this.request({ action: "save", zone: zone.id, record: body, id: old?.id, version: old?.version });
        this.records = [...this.records.filter(r => r.id !== saved.id), saved].sort((a,b) => a.name.localeCompare(b.name));
        this.editing = false; this.review = null; this.message = `已保存 ${saved.type} · ${saved.name}`; this.at = Date.now();
      } catch (e) {
        this.error = `${String(e.message ?? e)}。保存未确认；请返回列表刷新核对后再编辑。`;
        // A timed-out POST may have succeeded. Disable blind retries for this draft.
        this.uncertain = true; this.records = []; this.loadedZone = null;
      } finally { this.busy = false; cx.notify(); }
    });
  }
  text(value, c, color = c.dim) { return div().text_size(T.body).text_color(color).child(value); }
  field(label, state, c, multi = false) {
    return v_flex().gap(G.sm).child(this.text(label, c, c.muted))
      .child(controlInput(multi ? Textarea.new(state) : Input.new(state), c).w_full().when(multi, el => el.h(84)));
  }
  action(id, title, act, c, disabled = false, primary = false) {
    return Button.new(id).h(30).px(12).rounded(6).items_center().justify_center().disabled(disabled)
      .bg(primary ? c.primary : c.subtle).text_color(primary ? c.primaryText : c.text).text_size(T.body)
      .when(!disabled, el => el.cursor_pointer().hover(s => s.opacity(0.8)))
      .on_click((_e,cx) => { if (!disabled) act(cx); }).child(title);
  }
  listing(c) {
    const q = this.search.value().trim().toLowerCase();
    const rows = this.loadedZone === this.zone?.id ? this.records.filter(r => `${r.name} ${r.type} ${r.content}`.toLowerCase().includes(q)) : [];
    return v_flex().flex_1().min_h(0)
      .child(v_flex().flex_none().p(G.lg).gap(G.md)
        .child(section(c, "DNS 记录", this.busy ? "读取中…" : `${rows.length} / ${this.records.length}`))
        .child(quietTabs("cf-zones", this.zones.map(z => ({key:z.id,label:z.name})), this.zone?.id, (id,cx) => {
          if (this.busy) return; this.zone = this.zones.find(z => z.id === id); this.records = []; this.loadedZone = null; this.load(cx);
        }, c))
        .child(controlInput(Input.new(this.search),c).w_full())
        .child(h_flex().items_center().justify_between().child(this.text("Magpie 连接 · Cloudflare API",c))
          .child(this.action("cf-add", "＋ 新增记录", cx => { this.uncertain = false; this.edit(null,cx); }, c, this.busy || !this.zone || this.loadedZone !== this.zone.id))))
      .child(v_flex().id("cf-records").flex_1().min_h(0).overflow_y_scrollbar().px(G.lg).pb(G.lg).gap(G.xs)
        .when(!rows.length, el => el.child(this.text(this.busy ? "正在读取 Cloudflare…" : "暂无匹配记录",c)))
        .children(rows.map(r => Button.new(`cf-record-${r.id}`).w_full().p(G.md).rounded(6).disabled(this.busy)
          .when(!this.busy, el => el.cursor_pointer().hover(s => s.bg(c.subtle)).focus(s => s.bg(c.selected)))
          .accessibility_label(`编辑 ${r.type} ${r.name}`).on_click((_e,cx) => { if (!this.busy) { this.uncertain = false; this.edit(r,cx); } })
          .child(v_flex().w_full().min_w(0).gap(G.sm)
            .child(h_flex().gap(G.sm).items_center()
              .child(div().w(48).text_color(c.muted).text_size(T.small).child(r.type))
              .child(div().flex_1().min_w(0).truncate().text_size(T.card).child(r.name))
              .child(svg("mods/kanso-chrome/icons/chevron-right.svg").size(13).text_color(c.dim)))
            .child(div().min_w(0).truncate().text_color(c.muted).text_size(T.body).child(r.content))
            .child(this.text(`${r.proxied ? "已代理" : "仅 DNS"} · TTL ${ttlText(r.ttl)}${r.type === "MX" ? ` · 优先级 ${r.priority}` : ""}`, c)))
          .border_b(1).border_color(c.border))));
  }
  form(c) {
    const supported = TYPES.includes(this.kind);
    const goBack = cx => { if (this.busy) return; this.review = null; this.editing = false; this.error = null; cx.notify(); };
    const fields = this.review ? [
      ["名称", this.record?.name, this.review.name], ["类型", this.record?.type, this.review.type],
      ["内容", this.record?.content, this.review.content], ["TTL", this.record ? ttlText(this.record.ttl) : null, ttlText(this.review.ttl)],
      ["代理", this.record ? (this.record.proxied ? "已代理" : "仅 DNS") : null, this.review.proxied ? "已代理" : "仅 DNS"],
      ...(this.kind === "MX" ? [["优先级", this.record?.priority, this.review.priority]] : [])
    ] : [];
    return v_flex().id("cf-form").flex_1().min_h(0).overflow_y_scrollbar().p(G.lg).gap(G.lg)
      .child(h_flex().justify_between().items_center()
        .child(section(c, this.review ? "确认 DNS 变更" : this.record ? "编辑记录" : "新增记录")))
      .child(this.text(this.zone?.name ?? "",c))
      .when(Boolean(this.review), el => el
        .children(fields.map(([label,before,after]) => v_flex().gap(G.sm).pb(G.md).border_b(1).border_color(c.border)
          .child(this.text(label,c,c.muted))
          .when(before != null && String(before) !== String(after), e => e.child(this.text(`原值 · ${before}`,c)))
          .child(div().text_size(T.value).child(String(after)))))
        .child(this.text("确认后立即提交到 Cloudflare。提交前会重新核对记录版本。",c))
        .child(h_flex().gap(G.sm)
          .child(this.action("cf-revise", "返回编辑", cx => { this.review = null; cx.notify(); },c,this.busy || this.uncertain))
          .child(this.action("cf-save", this.busy ? "保存中…" : "确认保存", cx => this.save(cx),c,this.busy || this.uncertain,true))))
      .when(!this.review, el => el
        .child(this.record ? this.text(`类型 · ${this.kind}`,c,c.text) : quietTabs("cf-types", TYPES.map(key => ({key,label:key})),this.kind,(key,cx) => { this.kind=key; if (!["A","AAAA","CNAME"].includes(key)) this.proxy=false; cx.notify(); },c))
        .when(supported, e => e
          .child(this.field("记录名称 · @ 表示根域名",this.name,c))
          .child(this.field(this.kind === "TXT" ? "文本内容（保留引号及换行）" : "记录内容",this.content,c,true))
          .child(this.field("TTL · 1 为自动，其他值为秒",this.ttl,c))
          .when(this.kind === "MX", e => e.child(this.field("MX 优先级",this.priority,c)))
          .when(["A","AAAA","CNAME"].includes(this.kind), e => e.child(h_flex().items_center().justify_between()
            .child(this.text(this.proxy ? "Cloudflare 代理 · TTL 自动" : "仅 DNS",c,c.text))
            .child(toggleSwitch("cf-proxy",this.proxy,(v,cx) => { this.proxy=v; cx.notify(); },c,{label:"Cloudflare 代理"}))))
          .child(this.action("cf-review", "检查修改", cx => this.prepare(cx),c,this.busy || this.uncertain,true)))
        .when(!supported, e => e.child(this.text(`${this.kind} 暂仅支持查看`,c,c.yellow))
          .child(div().text_size(T.value).child(this.record?.content ?? ""))
          .child(div().text_size(T.body).child(JSON.stringify(this.record?.data ?? {})))))
      .child(quietLink("cf-back", "返回记录列表", goBack,c,{disabled:this.busy}));
  }
  render() {
    const c=tokens(theme());
    if (this.entry) return Button.new("cf-entry").size_full().items_center().justify_center().rounded(6).cursor_pointer()
      .accessibility_label("打开 Cloudflare DNS").tooltip("Cloudflare · DNS 管理").hover(s => s.bg(c.subtle)).on_click(() => this.open())
      .child(h_flex().gap(6).items_center().text_color(c.muted).text_size(T.body).child(svg(ICON).size(13)).child("Cloudflare"));
    return v_flex().id("cloudflare-panel").size_full().min_w(0).min_h(0).bg(c.canvas).text_color(c.text).text_size(T.value).track_focus(this.handle)
      .child(h_flex().flex_none().h(46).px(G.lg).gap(G.sm).items_center().border_b(1).border_color(c.border)
        .child(svg(ICON).size(16).text_color(c.muted)).child(div().flex_1().text_size(T.card).font_medium().child("Cloudflare"))
        .child(iconButton("cf-refresh","refresh","刷新域名和记录",cx => { if (!this.editing) this.load(cx,true); },c,{disabled:this.busy || this.editing,spin:this.busy}))
        .child(iconButton("cf-close","close","关闭面板",() => commitLayout({panel:null}),c,{disabled:this.busy})))
      .when(Boolean(this.error),el => el.child(div().flex_none().px(G.lg).py(G.sm).child(this.text(this.error,c,c.yellow))))
      .when(Boolean(this.message) && !this.editing,el => el.child(div().flex_none().px(G.lg).py(G.sm).child(this.text(this.message,c,c.green))))
      .child(this.editing ? this.form(c) : this.listing(c))
      .child(h_flex().flex_none().h(30).px(G.lg).items_center().border_t(1).border_color(c.border).text_size(T.small).text_color(c.dim)
        .child(div().flex_1().child("DNS 管理"))
        .child(this.at ? `更新于 ${new Date(this.at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}` : "尚未读取"));
  }
}
