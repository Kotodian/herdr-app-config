// The task's committed PR diff and its live worktree, separately. Only the person's exact review enables merge.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextareaState, Textarea, Scrollbar, v_virtual_list, VirtualListScrollHandle } from "gpui-base";
import { appHome, checking, closeOverlay, exec, nextCommand, openOverlay, props, theme } from "herdr";
import { where, shown, PR } from "./taskwhere.js";
import { VIEW_WORDS } from "./core/worktree.js";
import { patchRows, fileTree, reviewItems, reviewHistory, diffMode } from "./core/pr-diff.js";
import { colorDiff, codeSpans, syntaxColor } from "./core/pr-syntax.js";
import { settle } from "./core/pending.js";
import { button } from "./ui.js";

const LINE = 23, MONO = "JetBrains Mono";

async function cli(w, args) {
  const run = (args) => exec(`${appHome()}/mods/tasks/bin/herdr-task`, args);
  const r = await settle(run, await run(
    [...(w.machine ? ["--on", w.machine] : []), ...args, "--folder", w.listFolder || w.folder, "--json"]));
  let data;
  try { data = JSON.parse(r.stdout); } catch {}
  if (r.code || data?.error || !data) throw new Error(data?.error || r.stderr?.trim() || "Couldn't read the PR.");
  return data;
}

export default class PullRequest extends View {
  init(_props, cx) {
    this.fixed = props()?.where ?? null; this.wide = Boolean(props()?.wide); this.path = props()?.path ?? null;
    this.commentId = props()?.commentId ?? null; this.jumpTarget = props()?.jumpTarget ?? null;
    this.anchor = this.jumpTarget;
    this.current = null; this.error = null; this.rows = []; this.mode = "split"; this.host = cx;
    this.patch = null; this.patchSnapshot = null; this.working = false; this.fileSeq = 0;
    this.scroll = VirtualListScrollHandle.new(); this.handle = cx.focus_handle();
    this.search = InputState.new({ placeholder: "搜索变更文件" });
    this.search.on("change", (_e, cx) => cx.notify());
    this.commentBox = TextareaState.new({ placeholder: "写下需要修改的地方…" });
    this.commentBox.on("change", () => this.invalidate());
    this.commentTarget = null; this.folded = []; this.threads = new Map();
    if (checking()) return;
    this.refresh(cx);
    cx.timer.every(10000, (cx) => { if (this.wide || shown(PR)) this.refresh(cx); });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "expand" && !this.wide && shown(PR)) this.expand();
        if (c === "refresh") this.refresh(cx);
        cx.notify();
      }
    });
  }
  invalidate() {
    this.host.notify();
    for (const entity of this.threads.values()) this.host.notify(entity);
  }
  items() { return reviewItems(this.rows, this.current?.comments ?? [], this.commentTarget, this.patchSnapshot, this.path); }
  prepareThreads(cx) {
    const owner = this, items = this.items().filter((x) => x.kind === "thread"), keep = new Set(items.map((x) => x.key));
    for (const [key, entity] of this.threads) if (!keep.has(key)) { entity.release(); this.threads.delete(key); }
    for (const item of items) {
      if (!this.threads.has(item.key)) {
        const key = item.key;
        this.threads.set(key, cx.new(class extends View {
          render(cx) { return owner.thread(key, theme(), cx); }
        }));
      }
    }
    this.invalidate();
  }
  where() { return this.fixed ?? where(); }
  context() {
    const w = this.where();
    // GitHub's checked-at timestamp changes while this view reads a file. Only a different task changes context.
    return JSON.stringify(w ? [w.machine, w.ref, w.listFolder, w.folder, w.branch, w.base, w.pr?.repo, w.pr?.number, this.commentId] : null);
  }
  refresh(cx) {
    const w = this.where(), key = this.context();
    if (!w?.ref || this.loading || this.busy) return;
    if (key !== this.key) {
      this.key = key; this.current = null; this.rows = []; this.patch = null; this.commentTarget = null;
      this.patchSnapshot = null; this.fileSeq++; this.error = null;
    }
    this.loading = true;
    cx.spawn(async (cx) => {
      try {
        const current = await cli(w, ["review-diff", w.ref, ...(this.working ? ["--working"] : []),
          ...(this.commentId ? ["--comment-id", this.commentId] : [])]);
        if (key !== this.context()) return;
        if (this.current?.snapshot !== current.snapshot) this.message = null;
        this.current = current; this.error = null;
        if (!current.files.some((f) => f.path === this.path)) this.path = current.files[0]?.path ?? null;
        if (this.path) await this.loadFile(this.path, cx, false);
        else { this.rows = []; this.patch = null; this.patchSnapshot = current.snapshot; }
      } catch (e) { if (key === this.context()) this.error = String(e?.message ?? e); }
      finally { this.loading = false; cx.notify(); }
    });
  }
  async loadFile(path, cx, reset = true) {
    const seq = ++this.fileSeq, w = this.where(), key = this.context(), working = this.working;
    this.path = path; this.fileLoading = true;
    if (reset) { this.rows = []; this.patch = null; this.patchSnapshot = null; this.commentTarget = null; }
    cx.notify();
    try {
      const out = await cli(w, ["review-diff", w.ref, "--path", path, ...(working ? ["--working"] : []),
        ...(this.commentId ? ["--comment-id", this.commentId] : [])]);
      if (seq !== this.fileSeq || key !== this.context() || working !== this.working) return;
      this.current = out; this.patch = out.patch; this.patchSnapshot = out.snapshot; this.error = null;
      this.parsed = colorDiff(patchRows(out.patch.text), path); this.setRows();
      this.prepareThreads(cx);
      if (reset) this.scroll.scroll_to_item(0);
      if (this.jumpTarget?.path === path) {
        const target = this.jumpTarget, field = target.side === "LEFT" ? "left" : "right";
        const at = this.items().findIndex(item => item.kind === "code" && item.row[field]?.number === target.line);
        if (at >= 0) this.scroll.scroll_to_item(at, "center");
        else if (target.line) this.error = "评论的原始行不在此预览中，代码可能已截断。";
        this.jumpTarget = null;
      }
    } catch (e) { if (seq === this.fileSeq) this.error = String(e?.message ?? e); }
    finally { if (seq === this.fileSeq) this.fileLoading = false; cx.notify(); }
  }
  setRows() {
    this.displayMode = this.parsed ? diffMode(this.parsed, this.mode) : this.mode;
    this.rows = this.parsed?.[this.displayMode] ?? [];
    this.hunks = this.rows.flatMap((r, i) => r.kind === "hunk" ? [i] : []); this.hunk = 0;
    this.cellWidth = this.rows.reduce((width, r) =>
      Math.max(width, Math.max(r.left?.text.length ?? 0, r.right?.text.length ?? 0) * 7.3 + 72), 360);
  }
  pick(path, cx) {
    if (this.wide) cx.spawn(async (cx) => this.loadFile(path, cx));
    else this.expand(path);
  }
  selectLine(key, cx) {
    const target = JSON.parse(key);
    const press = this.pressX; this.pressX = null;
    if (press == null || press < 0 || press >= 24 || target.kind !== "code" || !target.line
      || target.snapshot !== this.current?.snapshot || target.path !== this.path || this.working || this.current?.historical) return;
    if (this.commentBox.value().trim() && this.commentTarget &&
      (target.line !== this.commentTarget.line || target.side !== this.commentTarget.side)) {
      this.error = "请先保存或取消正在编辑的评论。"; cx.notify(); return;
    }
    this.commentTarget = target; this.prepareThreads(cx);
    const at = this.items().findIndex((x) => x.kind === "thread" && x.editing);
    if (at >= 0) this.scroll.scroll_to_item(at, "center");
    this.commentBox.focus();
  }
  saveComment(cx, remove = null) {
    const c = this.current, target = this.commentTarget, body = this.commentBox.value().trim();
    if (this.busy || this.working || !c || c.historical || (!remove && (!body || !target))) return;
    if (!remove && target && target.snapshot !== c.snapshot) {
      this.error = "代码版本已变化，请重新选择评论行。输入的评论已保留。"; cx.notify(); return;
    }
    this.busy = "comment"; this.error = null; cx.notify();
    const args = ["review-comment", this.where().ref, "--snapshot", c.snapshot];
    if (remove) args.push("--remove", remove);
    else {
      args.push("--body", body);
      if (target?.path || this.path) args.push("--path", target?.path || this.path);
      if (target?.line) args.push("--line", String(target.line), "--side", target.side);
    }
    cx.spawn(async (cx) => {
      try {
        const out = await cli(this.where(), args);
        this.current = { ...this.current, ...out };
        if (!remove) { this.commentBox.set_value(""); this.commentTarget = null; }
        this.prepareThreads(cx);
      } catch (e) { this.error = String(e?.message ?? e); }
      finally { this.busy = false; this.invalidate(); }
    });
  }
  expand(path = this.path) {
    openOverlay({ kind: "dialog", mod: "task-pr", width: 0.96, height: 0.92,
      props: { wide: true, where: this.where(), path, commentId: this.commentId, jumpTarget: this.jumpTarget } });
  }
  jumpComment(comment) {
    if (!comment.path) return;
    if (this.commentBox.value().trim()) {
      this.error = "请先保存或取消正在编辑的评论。"; this.invalidate(); return;
    }
    if (props()?.overlay) closeOverlay(props().overlay);
    openOverlay({ kind: "dialog", mod: "task-pr", width: 0.96, height: 0.92,
      props: { wide: true, where: this.where(), path: comment.path, commentId: comment.id,
        jumpTarget: { path: comment.path, line: comment.line, side: comment.side } } });
  }
  async commentAction(comment, cx) {
    if (this.busy) return;
    this.busy = comment ? "resolve" : "sync"; this.error = null; this.invalidate();
    try {
      const w = this.where(), out = await cli(w, comment
        ? ["resolve-review-comment", w.ref, "--comment-id", comment.id, ...(comment.status === "resolved" ? ["--reopen"] : [])]
        : ["sync-review-comments", w.ref]);
      this.current = { ...this.current, ...out }; this.prepareThreads(cx);
    } catch (e) { this.error = String(e?.message ?? e); }
    finally { this.busy = false; this.invalidate(); }
  }
  resolveButton(comment) {
    return button(`pr-comment-resolve-${comment.id}`, comment.status === "resolved" ? "重新打开" : "标记已解决", {
      kind: "plain", disabled: Boolean(this.busy),
      onClick: (_e, cx) => this.commentAction(comment, cx),
    });
  }
  scope(working, cx) {
    if (working === this.working || this.loading || this.busy || this.current?.historical) return;
    this.working = working; this.fileSeq++; this.rows = []; this.patchSnapshot = null;
    this.refresh(cx); cx.notify();
  }
  navigate(delta, cx) {
    const hunks = this.items().flatMap((x, i) => x.kind === "code" && x.row.kind === "hunk" ? [i] : []);
    if (!hunks.length) return;
    this.hunk = Math.max(0, Math.min(hunks.length - 1, (this.hunk ?? 0) + delta));
    this.scroll.scroll_to_item(hunks[this.hunk], "top"); cx.notify();
  }
  async action(command, cx) {
    const current = this.current, w = this.where();
    if (this.busy || !current || this.working || current.historical || !["approve", "changes"].includes(command)) return;
    this.busy = command; this.error = null; cx.notify();
    try {
      if (command === "approve") {
        const out = await cli(w, ["approve-review", w.ref, "--snapshot", current.snapshot]);
        this.current = { ...current, ...out };
        this.message = null;
      } else if (command === "changes") {
        const out = await cli(w, ["request-changes", w.ref, "--snapshot", current.snapshot]);
        this.current = { ...current, ...out };
        this.message = "已要求修改 · Worker 将逐条处理评论，完成后请重新审核";
      }
    } catch (e) { this.error = String(e?.message ?? e); }
    finally { this.busy = false; this.invalidate(); }
  }
  thread(key, t, cx) {
    const item = this.items().find((x) => x.key === key);
    if (!item) return div();
    const target = this.commentTarget;
    const labels = { draft: "草稿", changes: "已要求修改", resolved: "已解决", commented: "审核意见" };
    return h_flex().h(item.height).w_full().bg(t.raised)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => cx.stop_propagation())
      .child(v_flex().flex_1().min_w(this.cellWidth).h_full().px(24).py(4).gap(0)
        .children(item.comments.map((comment) => v_flex().h(100).flex_none().p(8).gap(4).border_l(2).border_color(t.accent).bg(t.background)
          .child(h_flex().gap(8).items_center()
            .child(div().flex_1().text_size(10).text_color(t.dim)
              .child(`${labels[comment.status] || comment.status} · 第 ${comment.line} 行`))
            .when(!this.current?.historical && comment.status === "draft" && comment.snapshot === this.current?.snapshot, (el) => el.child(
              button(`pr-comment-delete-${comment.id}`, "删除", { kind: "plain", disabled: this.busy,
                onClick: (_e, cx) => this.saveComment(cx, comment.id) })))
            .when(comment.status !== "draft" && Boolean(comment.path && this.current?.pr?.number),
              el => el.child(this.resolveButton(comment))))
          .child(div().flex_1().min_h(0).overflow_y_scrollbar().text_size(12).child(comment.body))))
        .when(item.editing, (el) => el.child(v_flex().h(210).flex_none().p(10).gap(8).border_l(2).border_color(t.accent).bg(t.background)
          .child(div().text_size(11).text_color(t.accent).child(`第 ${target.line} 行`))
          .child(div().h(85).flex_none().overflow_y_scrollbar().rounded(5).bg(t.input).p(8)
            .child(Textarea.new(this.commentBox).w_full().text_size(12).text_color(t.foreground)))
          .child(h_flex().gap(8)
            .child(button("pr-comment-add", this.busy === "comment" ? "保存中…" : "保存评论", {
              disabled: this.busy || this.working || !this.commentBox.value().trim(),
              onClick: (_e, cx) => this.saveComment(cx),
            }))
            .child(button("pr-comment-cancel", "取消", { kind: "plain", disabled: this.busy, onClick: () => {
              this.commentBox.set_value(""); this.commentTarget = null; this.invalidate();
            } }))))))
      .when(this.displayMode === "split", (el) => el.child(div().flex_1().min_w(this.cellWidth).h_full()));
  }
  ready() {
    const c = this.current;
    return Boolean(c && !c.historical && c.state === "ready" && !c.dirty.length && c.local_matches && !c.limited
      && !this.working && !this.loading && !this.fileLoading && !this.busy
      && this.patchSnapshot === c.snapshot && !this.patch?.limited);
  }
  approvalText() {
    const c = this.current;
    if (c.historical) return "评论原提交 · 只读";
    if (c.state === "done") return "任务已完成";
    if (!c.approved) return c.approval ? "代码或基准已变化，之前的审核已失效" : "待人工审核 · 通过后自动交给 Assistant 合并";
    if (c.handoff?.state === "sent") return `已审核 ${c.head.slice(0, 8)} · 已交给 Assistant 合并，等待执行结果`;
    return `已审核 ${c.head.slice(0, 8)} · ${c.handoff?.error || "等待交给 Assistant，系统会自动重试"}`;
  }
  note(text, t, error = false) {
    return div().p(18).text_size(12).text_color(error ? t.ansi1 : t.dim).child(text);
  }
  files(t, cx) {
    const all = this.current?.files ?? [], query = this.search.value().toLowerCase();
    const files = fileTree(all, query, this.folded);
    return v_flex().w(this.wide ? 260 : "100%").h_full().min_h(0).flex_none()
      .when(this.wide, (el) => el.border_r(1).border_color(t.border))
      .child(h_flex().h(42).flex_none().px(10).items_center().border_b(1).border_color(t.border)
        .child(Input.new(this.search).w_full().text_size(12).text_color(t.foreground)))
      .child(div().relative().flex_1().min_h(0)
        .child(v_flex().id("pr-review-files").absolute().inset_0().overflow_y_scroll().py(4)
          .children(files.map((node) => {
            if (node.kind === "directory") return h_flex().id(`pr-dir-${node.path}`).h(30).flex_none()
              .pl(10 + node.depth * 14).pr(12).gap(7).items_center().cursor_pointer().hover((el) => el.bg(t.hover))
              .on_click((_e, cx) => {
                this.folded = this.folded.includes(node.path) ? this.folded.filter((p) => p !== node.path) : [...this.folded, node.path]; cx.notify();
              })
              .child(div().w(10).text_size(11).text_color(t.dim).child(node.folded ? "›" : "⌄"))
              .child(div().flex_1().truncate().text_size(12).text_color(t.foreground).child(node.name))
              .child(div().text_size(10).text_color(t.dim).child(String(node.count)));
            const file = node.file;
            const color = file.status === "A" ? t.ansi2 : file.status === "D" ? t.ansi1 : t.accent;
            return h_flex().id(`pr-file-${file.path}`).h(31).flex_none().pl(26 + node.depth * 14).pr(12).gap(8).items_center().cursor_pointer()
              .when(this.path === file.path, (el) => el.bg(t.selected)).hover((el) => el.bg(t.hover))
              .on_click((_e, cx) => this.pick(file.path, cx))
              .child(div().w(12).flex_none().font_family(MONO).text_size(11).text_color(color).child(file.status))
              .child(div().flex_1().min_w(0).truncate().text_size(12).child(node.name))
              .child(h_flex().flex_none().text_size(10).gap(5)
                .child(div().text_color(t.ansi2).child(file.add ? `+${file.add}` : ""))
                .child(div().text_color(t.ansi1).child(file.del ? `−${file.del}` : "")));
          }))
          .when(!files.length, (el) => el.child(this.note(all.length ? "没有匹配的文件" : "没有代码差异", t))))
        .child(Scrollbar.vertical("pr-review-files").absolute().inset_0()))
      .when(Boolean(this.current?.comments?.length), el => el.child(
        v_flex().h(220).flex_none().min_h(0).border_t(1).border_color(t.border)
          .child(div().flex_none().p(10).font_semibold().text_size(12).child(`审核意见 · ${this.current.comments.length}`))
          .child(v_flex().id("pr-review-history").flex_1().min_h(0).overflow_y_scrollbar().px(10).pb(10).gap(10)
            .children(reviewHistory(this.current.comments, this.current.snapshot).map(comment =>
              v_flex().flex_none().gap(5).p(8).rounded(6).bg(t.raised)
                .child(div().text_size(10).text_color(t.accent).child(`${comment.outdated ? "旧提交 · " : ""}${comment.head?.slice(0, 8) ?? ""} · ${comment.status === "changes" ? "待人工复核" : comment.status === "resolved" ? "已解决" : comment.status === "draft" ? "草稿" : "审核意见"}`))
                .child(div().id(`pr-comment-location-${comment.id}`).text_size(10).text_color(comment.path ? t.accent : t.dim)
                  .when(Boolean(comment.path), el => el.cursor_pointer().tooltip("打开评论时的代码并定位到行")
                    .hover(s => s.bg(t.hover)).on_click(() => this.jumpComment(comment)))
                  .child(`${comment.path ?? "PR"}${comment.line ? `:${comment.line}` : ""}`))
                .child(div().text_size(12).child(comment.body))
                .when(comment.status !== "draft" && Boolean(comment.path && this.current?.pr?.number),
                  el => el.child(this.resolveButton(comment)))
                .when(Boolean(comment.pr_comment?.url), el => el.child(button(`pr-comment-link-${comment.id}`, "在 PR 查看", {
                  kind: "plain", onClick: (_e, cx) => cx.open_url(comment.pr_comment.url),
                })))
                .when(Boolean(comment.pr_sync_error), el => el.child(div().text_size(10).text_color(t.ansi1)
                  .child(`PR 同步未完成：${comment.pr_sync_error}`))))))));
  }
  code(side, pieces, changed, t, direction) {
    const color = direction === "left" ? t.ansi1 : t.ansi2;
    return h_flex().flex_1().min_w(this.cellWidth).h(LINE).items_center()
      .when(changed && Boolean(side), (el) => el.bg(color + "18")).when(!side, (el) => el.bg(t.raised))
      .child(div().w(48).flex_none().pr(10).text_right().text_color(t.dim).child(side ? String(side.number) : ""))
      .child(h_flex().flex_none().pl(10).items_center()
        .children(codeSpans(side, pieces).map((span) => div().flex_none()
          .when(Boolean(syntaxColor(span.scope, t.appearance === "light")), (el) => el.text_color(syntaxColor(span.scope, t.appearance === "light")))
          .when(span.changed, (el) => el.bg(color + "38")).child(span.text))));
  }
  diffRow(row, t) {
    if (row.kind === "hunk") return h_flex().h(LINE).w_full().items_center().px(16).bg(t.raised).text_color(t.dim).child(row.text);
    if (this.displayMode === "unified") {
      const text = row.right ?? row.left;
      return h_flex().h(LINE).w_full().items_center()
        .when(row.kind !== "context", (el) => el.bg((row.kind === "delete" ? t.ansi1 : t.ansi2) + "18"))
        .child(div().w(44).pr(8).flex_none().text_right().text_color(t.dim).child(String(row.left?.number ?? "")))
        .child(div().w(44).pr(8).flex_none().text_right().text_color(t.dim).child(String(row.right?.number ?? "")))
        .child(h_flex().pl(12).flex_none().children(codeSpans(text).map((span) => div().flex_none()
          .when(Boolean(syntaxColor(span.scope, t.appearance === "light")), (el) => el.text_color(syntaxColor(span.scope, t.appearance === "light"))).child(span.text))));
    }
    return h_flex().h(LINE).w_full()
      .child(this.code(row.left, row.inline?.left, row.kind !== "context", t, "left"))
      .child(div().w(1).flex_none().h_full().bg(t.border))
      .child(this.code(row.right, row.inline?.right, row.kind !== "context", t, "right"));
  }
  anchored(row) {
    return this.anchor?.path === this.path && this.anchor?.line
      && row[this.anchor.side === "LEFT" ? "left" : "right"]?.number === this.anchor.line;
  }
  diff(t, cx) {
    const c = this.current, items = this.items();
    const pickMode = (mode) => { this.mode = mode; this.setRows(); this.prepareThreads(cx); this.scroll.scroll_to_item(0); };
    return v_flex().flex_1().h_full().min_w(0).min_h(0)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().flex_1().min_w(0).truncate().font_medium().text_size(12).child(this.path ?? "选择一个变更文件"))
        .child(button("pr-side-by-side", "左右对比", { kind: this.mode === "split" ? "secondary" : "plain", onClick: () => pickMode("split") }))
        .child(button("pr-unified", "统一视图", { kind: this.mode === "unified" ? "secondary" : "plain", onClick: () => pickMode("unified") }))
        .child(button("pr-prev-hunk", "↑", { disabled: !this.hunks?.length, onClick: (_e, cx) => this.navigate(-1, cx) }))
        .child(button("pr-next-hunk", "↓", { disabled: !this.hunks?.length, onClick: (_e, cx) => this.navigate(1, cx) })))
      .child(h_flex().h(31).flex_none().items_center().border_b(1).border_color(t.border).text_size(11).text_color(t.dim)
        .when(this.displayMode === "split", (el) => el.child(div().flex_1().px(14).child(`基准 · ${c?.base ?? ""} · ${c?.merge_base?.slice(0, 8) ?? ""}`)))
        .child(div().flex_1().px(14).child(`${this.current.files.find((f) => f.path === this.path)?.status === "A" ? "新增文件 · " : ""}${this.working ? "当前 Worktree · 含未提交改动" : `本地 Commit · ${c?.head?.slice(0, 8) ?? ""}`}`)))
      .child(div().relative().flex_1().min_h(0).font_family(MONO).text_size(12)
        .on_mouse_down("left", (e) => { this.pressX = e.local_position?.x ?? null; })
        .child(div().id("pr-review-diff-x").size_full().overflow_x_scrollbar()
          .child(div().min_w((this.cellWidth ?? 360) * (this.displayMode === "split" ? 2 : 1) + 25).w_full().h_full()
            .child(v_virtual_list("pr-review-diff", items.length, items.map((x) => x.height), (i) => {
              const item = items[i], row = item.row, side = row.right ? "RIGHT" : "LEFT";
              return JSON.stringify({ kind: item.kind, index: i, snapshot: this.patchSnapshot, path: this.path, side,
                line: (row.right || row.left)?.number ?? 0 });
            },
              (range) => items.slice(range.start, range.end).map((item) => item.kind === "thread"
                ? div().h(item.height).w_full().child(this.threads.get(item.key))
                : h_flex().h(LINE).w_full()
                  .when(this.anchored(item.row), el => el.bg(t.selected))
                  .child(div().w(24).h(LINE).flex_none().text_center().text_color(t.accent)
                    .when(!this.working && !c.historical && item.row.kind !== "hunk", (el) => el.cursor_pointer().hover((s) => s.bg(t.selected)).child("+")))
                  .child(this.diffRow(item.row, t).flex_1().min_w(0)))).size_full().track_scroll(this.scroll)
              .on_item_click((key, cx) => this.selectLine(key, cx)))))
        .child(Scrollbar.vertical("pr-review-diff").absolute().inset_0())
        .when(!this.rows.length, (el) => el.child(div().absolute().inset_0().flex().items_center().justify_center()
          .child(this.note(this.fileLoading ? "正在读取代码…" : this.patch?.binary ? VIEW_WORDS.binaryDiff : this.path ? "没有可显示的文本差异" : "选择文件查看 Diff", t)))))
      .when(Boolean(this.patch?.limited), (el) => el.child(this.note("文件过大，当前预览已截断，暂不能审核通过。", t, true)));
  }
  render(cx) {
    if (!checking() && this.key !== this.context() && !this.loading) this.refresh(cx);
    const t = theme(), c = this.current, w = this.where();
    const root = v_flex().id("task-pr").size_full().min_h(0).overflow_hidden().bg(t.background)
      .text_color(t.foreground).text_size(13).track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "escape" && props()?.overlay) closeOverlay(props().overlay);
        else if (e.key === "f7") this.navigate(e.modifiers?.shift ? -1 : 1, cx);
      });
    if (!w?.ref) return root.child(this.note("No task open.", t));
    if (!c) return root.child(this.note(this.error || "正在读取本地 Commit…", t, Boolean(this.error)));
    const drafts = (c.comments ?? []).filter((x) => x.snapshot === c.snapshot && x.status === "draft");
    return root
      .child(h_flex().h(52).flex_none().px(16).gap(10).items_center().border_b(1).border_color(t.border)
        .child(svg("mods/task-pr/git-pull-request.svg").size(17).text_color(t.accent))
        .child(v_flex().flex_1().min_w(0).gap(3)
          .child(div().font_semibold().truncate().child(`${c.pr?.number ? `#${c.pr.number} · ` : ""}${c.title}`))
          .child(div().text_size(11).text_color(t.dim).truncate()
            .child(`${c.branch} → ${c.base}  ·  ${c.historical ? `评论原提交 ${c.head.slice(0, 8)} · 只读` : "本地 Commit"}`)))
        .when(!this.wide, (el) => el.child(button("pr-expand", "查看 Diff", { onClick: () => this.expand() })))
        .when(Boolean(c.pr_url), (el) => el.child(button("pr-github", VIEW_WORDS.openOnGitHub, { kind: "plain", onClick: (_e, cx) => cx.open_url(c.pr_url) })))
        .when(Boolean(props()?.overlay), (el) => el.child(button("pr-close", "关闭", { kind: "plain", onClick: () => closeOverlay(props().overlay) }))))
      .child(h_flex().h(38).flex_none().px(12).gap(8).items_center().border_b(1).border_color(t.border).text_size(11)
        .child(button("pr-committed", "本地 Commit", { kind: !this.working ? "secondary" : "plain", disabled: this.busy, onClick: (_e, cx) => this.scope(false, cx) }))
        .child(button("pr-working", "Worktree 实时", { kind: this.working ? "secondary" : "plain", disabled: this.busy || c.historical, onClick: (_e, cx) => this.scope(true, cx) }))
        .child(div().flex_1()).child(div().text_color(t.dim).child(`${c.file_count} files`))
        .child(div().text_color(t.ansi2).child(`+${c.add}`)).child(div().text_color(t.ansi1).child(`−${c.delete}`))
        .when(this.wide, (el) => el.child(div().text_color(t.dim).child("点击行号左侧 +，在该行上方评论")))
        .when(Boolean(c.pr?.number), el => el.child(button("pr-sync-comments", "同步评论", {
          kind: "plain", disabled: this.busy, onClick: (_e, cx) => this.commentAction(null, cx),
        })))
        .child(button("pr-refresh", "刷新", { kind: "plain", disabled: this.loading || this.busy, onClick: (_e, cx) => this.refresh(cx) })))
      .when(Boolean(c.dirty.length || !c.local_matches), (el) => el.child(this.note(
        !c.local_matches ? "Worktree 与任务分支的本地 Commit 不同，请检查分支并刷新。" : `Worktree 另有 ${c.dirty.length} 个未提交文件。`, t, true)))
      .child(h_flex().flex_1().min_h(0).min_w(0).items_stretch().child(this.files(t, cx))
        .when(this.wide, (el) => el.child(this.diff(t, cx))))
      .when(Boolean(this.error), (el) => el.child(div().max_h(100).overflow_y_scrollbar().child(this.note(this.error, t, true))))
      .child(v_flex().flex_none().px(16).py(12).gap(10).border_t(1).border_color(t.border)
        .child(div().text_size(11).text_color(c.approved ? t.ansi2 : t.dim)
          .child(this.message || this.approvalText()))
        .child(h_flex().gap(8).items_center()
          .when(!this.wide, (el) => el.child(button("pr-review", "查看 Diff 并审核", { kind: "primary", size: "lg", onClick: () => this.expand() })))
          .when(this.wide, (el) => el
            .child(button("pr-request-changes", `要求修改 · ${drafts.length} 条评论`, {
              size: "lg", disabled: this.busy || c.historical || !drafts.length || c.state !== "ready" || this.working || this.loading || Boolean(this.message),
              onClick: (_e, cx) => cx.spawn(async (cx) => this.action("changes", cx)),
            }))
            .child(button("pr-approve", this.busy === "approve" ? "正在交给 Assistant…" : c.approved ? "已审核通过" : "审核通过", {
              size: "lg", disabled: !this.ready() || c.approved, onClick: (_e, cx) => cx.spawn(async (cx) => this.action("approve", cx)),
            })))));
  }
}
