import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, InputState, Input, TextView } from "gpui-base";
import { spaces, theme, exec, appHome, nextCommand } from "herdr";
import * as fs from "fs/promises";
import { spaceIssues, spaceIssue } from "./context-source.js";
import { commitLayout } from "./panels.js";
import { closeIssue } from "./actions.js";

const ICON = "mods/local-issues/github.svg";
export default class IssuesPanel extends View {
  init(_p, cx) {
    this.search = InputState.new({ placeholder: "搜索 Issue 编号或标题" });
    this.search.on("change", (_e, cx) => cx.notify());
    this.key = ""; this.generation = 0; this.data = null; this.selected = null; this.detail = null;
    this.closing = false; this.closeConfirm = false; this.closeReason = "completed";
    this.follow(cx);
    cx.timer.every(1000, (cx) => this.follow(cx));
    cx.spawn(async (cx) => { for (;;) { if (String(await nextCommand()).endsWith("refresh")) this.load(cx); } });
  }
  close() { this.generation++; this.search.release(); }
  follow(cx) {
    const space = spaces().find((s) => s.active);
    const key = space ? `${space.id}:${space.machine}:${space.folder}` : "";
    if (key === this.key) return;
    this.key = key; this.space = space; this.data = null; this.selected = null; this.detail = null;this.closeConfirm=false;this.message=null;
    this.load(cx);
  }
  runner(space) { return (cmd, args) => exec(cmd, args, { on: space?.machine, timeout: 90000 }); }
  load(cx) {
    const space = this.space, generation = ++this.generation;
    this.busy = true; this.error = null; cx.notify();
    cx.spawn(async (cx) => {
      try {
        const data = await spaceIssues(space?.folder, this.runner(space));
        const dir = `${appHome()}/data/github-issue-drag`;
        await fs.mkdir(dir, { recursive: true });
        await Promise.all(data.issues.map(async (x) => {
          const path = `${dir}/${data.repo.replace("/", "--")}-${x.number}.issue.json`;
          await fs.writeFile(path, JSON.stringify({ kind: "github-issue", url: x.url }));
          x.dragPath = path;
        }));
        if (generation === this.generation) { this.data = data; this.at = Date.now(); }
      } catch (e) { if (generation === this.generation) this.error = String(e.message ?? e); }
      finally { if (generation === this.generation) { this.busy = false; cx.notify(); } }
    });
  }
  show(row, cx) {
    const space = this.space, generation = this.generation;
    this.selected = row; this.detail = null; this.error = null; this.closeConfirm=false; cx.notify();
    cx.spawn(async (cx) => {
      try {
        const detail = await spaceIssue(row.url, space?.folder, this.runner(space));
        if (generation === this.generation && this.selected === row) this.detail = detail.text;
      } catch (e) { if (generation === this.generation && this.selected === row) this.error = String(e.message ?? e); }
      cx.notify();
    });
  }
  closeIssue(cx) {
    if(this.closing||!this.selected)return;
    const row=this.selected,space=this.space,key=this.key;
    this.closing=true;this.error=null;cx.notify();
    cx.spawn(async cx=>{
      try{
        await closeIssue(row.url,space?.folder,this.runner(space),this.closeReason);
        if(this.key!==key)return;
        ++this.generation;this.busy=false;
        this.data={...this.data,issues:(this.data?.issues??[]).filter(x=>x.number!==row.number)};
        this.selected=null;this.detail=null;this.closeConfirm=false;this.message=`已关闭 #${row.number} ${row.title}`;
      }catch(e){if(this.key===key)this.error=String(e.message??e);}
      finally{this.closing=false;cx.notify();}
    });
  }
  button(id, label, fn, t, disabled=false) {
    return div().id(id).px(8).py(5).rounded(5).cursor_pointer().hover((s) => s.bg(t.hover))
      .when(disabled,el=>el.opacity(.5))
      .on_click((_e, cx) => { cx.stop_propagation(); if(!disabled)fn(cx); }).child(label);
  }
  render() {
    const t = theme(), selected = this.selected;
    const q = this.search.value().trim().toLowerCase();
    const rows = (this.data?.issues ?? []).filter((x) => `#${x.number} ${x.title}`.toLowerCase().includes(q));
    return v_flex().id("github-issues-panel").size_full().min_w(0).min_h(0).bg(t.canvas ?? t.background).text_color(t.foreground).text_size(12.5)
      .child(h_flex().h(46).flex_none().px(12).gap(8).items_center().border_b(1).border_color(t.border)
        .when(Boolean(selected), (el) => el.child(this.button("issue-back", "返回", (cx) => { this.selected = null; this.detail = null; this.error = null; cx.notify(); }, t,this.closing)))
        .child(svg(ICON).size(16)).child(div().flex_1().font_medium().child("GitHub Issues"))
        .child(this.button("issues-refresh", this.busy ? "读取中…" : "刷新", (cx) => { if (!this.busy) this.load(cx); }, t,this.closing))
        .child(this.button("issues-close", "×", () => commitLayout({ panel: null }), t)))
      .child(v_flex().flex_none().p(12).gap(8)
        .child(div().text_color(t.dim).child(this.data?.repo ?? this.space?.name ?? "当前 Space"))
        .child(div().text_size(11.5).text_color(t.dim).child("拖动 Issue 到 Assistant 输入框，单击查看正文和讨论"))
        .when(!selected, (el) => el.child(Input.new(this.search).w_full().h(30).px(8).rounded(6).bg(t.input))))
      .when(Boolean(this.error), (el) => el.child(div().px(12).py(8).text_color(t.blocked).child(this.error ?? "")))
      .when(Boolean(this.message),el=>el.child(div().px(12).py(8).text_color(t.done).child(this.message??"")))
      .when(Boolean(selected), (el) => el.child(v_flex().id("issue-detail").flex_1().min_h(0).overflow_y_scrollbar().p(12).gap(12)
        .child(div().id("issue-detail-drag").drag_paths([selected.dragPath]).cursor_pointer().font_medium().text_size(16).child(`#${selected.number} ${selected.title}`))
        .child(this.button("issue-close-action","关闭 Issue",cx=>{this.closeConfirm=true;cx.notify();},t,this.closing))
        .when(this.closeConfirm,el=>el.child(v_flex().p(10).gap(8).rounded(6).border_1().border_color(t.border)
          .child(div().child(`关闭 ${this.data?.repo} #${selected.number}`))
          .child(h_flex().gap(6)
            .child(this.button("issue-close-completed",`${this.closeReason==="completed"?"●":"○"} 已完成`,cx=>{this.closeReason="completed";cx.notify();},t,this.closing))
            .child(this.button("issue-close-not-planned",`${this.closeReason==="not_planned"?"●":"○"} 不再计划`,cx=>{this.closeReason="not_planned";cx.notify();},t,this.closing)))
          .child(h_flex().gap(6)
            .child(this.button("issue-close-confirm",this.closing?"关闭中…":"确认关闭",cx=>this.closeIssue(cx),t,this.closing))
            .child(this.button("issue-close-cancel","取消",cx=>{this.closeConfirm=false;cx.notify();},t,this.closing)))))
        .child(TextView.markdown("issue-detail-content", this.detail ?? (this.error ? "读取失败，请返回列表重试。" : "正在读取正文和讨论…")).text_size(12.5).text_color(t.foreground))))
      .when(!selected, (el) => el.child(v_flex().id("issue-list").flex_1().min_h(0).overflow_y_scrollbar().px(12).pb(12).gap(4)
        .when(!rows.length, (el) => el.child(div().py(20).text_color(t.dim).child(this.busy ? "正在读取当前仓库的 Issue…" : this.error ? "列表读取失败，请刷新重试。" : this.data?.issues.length ? "没有符合搜索条件的 Issue。" : "当前仓库没有开放的 Issue。")))
        .children(rows.map((x) => v_flex().id(`space-issue-${x.number}`).drag_paths([x.dragPath]).w_full().p(10).gap(6).rounded(6)
          .cursor_pointer().hover((s) => s.bg(t.hover)).border_b(1).border_color(t.border)
          .on_click((_e, cx) => this.show(x, cx))
          .child(div().text_color(t.dim).text_size(11.5).child(`#${x.number}`))
          .child(div().text_size(13.5).child(x.title))
          .child(div().text_color(t.dim).text_size(11).child(`更新于 ${x.updated ?? "—"}`))))))
      .child(div().h(28).flex_none().px(12).pt(6).border_t(1).border_color(t.border).text_color(t.dim).text_size(11)
        .child(this.data ? `${this.data.issues.length} 个开放 Issue · 监听由此 Space 的 Autopilot 控制` : "沿用当前 Space 的仓库和 gh 登录"));
  }
}
