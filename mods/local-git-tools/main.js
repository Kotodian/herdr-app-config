import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, spaces, panes, focused, layout, run, exec, hc, nextCommand, openOverlay, notify, shared, setShared } from "herdr";

function context() {
  const f = focused(), space = spaces().find(s => s.active);
  const pane = panes().find(p => p.pane === f?.pane);
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on: space?.machine ?? null };
}
function node(tree, id) {
  if (!tree) return null;
  if (tree.id === id) return tree;
  for (const child of tree.children ?? []) { const found = node(child, id); if (found) return found; }
  return null;
}

export default class GitTools extends View {
  init(_p, cx) {
    this.git = null; this.busy = false; this.opening = false;
    this.refresh(cx);
    cx.timer.every(10000, cx => this.refresh(cx));
    cx.spawn(async cx => {
      for (;;) {
        const c = await nextCommand();
        if (c === "changes") this.changes();
        if (c === "lazygit" || c === "magpie") this.tool(c, cx);
        if (c === "enable-panels") setShared("workspace.panels", [...new Set([...(shared("workspace.panels") ?? []), "files", "changes"])]);
      }
    });
  }

  refresh(cx) {
    const c = context(), key = JSON.stringify(c);
    if (this.busy || !c.cwd) return;
    this.busy = true; this.key = key;
    cx.spawn(async cx => {
      try {
        const r = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--branch", "--no-renames", "--untracked-files=all"], c);
        if (JSON.stringify(context()) !== key) return;
        if (r.code !== 0) { this.git = null; return; }
        const rows = r.stdout.split("\0").filter(Boolean), head = rows.shift() || "";
        this.git = { branch: head.replace(/^## /, "").split("...")[0], count: rows.filter(x => x.length > 2 && x[2] === " ").length };
      } catch { if (JSON.stringify(context()) === key) this.git = null; }
      finally { this.busy = false; cx.notify(); }
    });
  }

  changes() {
    const tree = layout(), panel = node(tree, "panel"), stack = node(tree, "panel-body");
    if (panel && stack) {
      const hide = !panel.hidden && stack.active === "changes";
      run("layout.select", { stack: "panel-body", child: "changes" });
      run(hide ? "layout.hide" : "layout.show", { id: "panel" });
    } else {
      run("tab.new", { mod: "changes", name: "Git Changes" });
    }
  }

  tool(which, cx) {
    if (this.opening) return;
    const c = context(), magpie = which === "magpie";
    if (!magpie && !c.cwd) return;
    this.opening = true;
    cx.spawn(async cx => {
      let address;
      try {
        const args = ["run", "--json", "--bg", "--no-parent", "--no-notify", "--outlive-parent"];
        if (!magpie && c.on) args.push("--on", c.on);
        if (!magpie && c.cwd) args.push("--cwd", c.cwd);
        args.push("--", magpie ? "/Applications/magpie.app/Contents/MacOS/magpie" : c.on ? "lazygit" : "/opt/homebrew/bin/lazygit");
        if (magpie) args.push("tui");
        const r = await hc(args);
        if (r.code !== 0) throw new Error(r.stderr || "无法启动工具");
        const data = JSON.parse(r.stdout); address = data.address;
        if (!address) throw new Error("工具未返回终端地址");
        const overlay = openOverlay({
          kind: "window", key: magpie ? "local-magpie-manager" : "local-lazygit",
          width: 0.9, height: 0.85,
          layout: { id: "tool-window", type: "column", children: [
            { id: "tool-title", type: "block", size: { px: 36 },
              content: { mod: "local-tool-window", props: { terminal: address, title: magpie ? "Magpie 管理器 · 本机" : `LazyGit · ${c.on || "本机"} · ${c.cwd}` } } },
            { id: "tool-terminal", type: "block", content: { terminal: address } },
          ] },
        });
        if (!overlay) throw new Error("无法打开工具窗口");
      } catch (e) {
        if (address) await hc(["kill", address]);
        notify({ title: "工具启动失败", body: String(e), level: "error" });
      } finally { this.opening = false; cx.notify(); }
    });
  }

  render(cx) {
    if (JSON.stringify(context()) !== this.key) this.refresh(cx);
    const t = theme();
    const button = (id, text, action) => div().id(id).px(10).h_full().flex().items_center().cursor_pointer()
      .hover(s => s.bg(t.hover)).on_click(action).child(text);
    return h_flex().id("git-tools").size_full().gap(2).items_center().text_size(12).text_color(t.foreground)
      .child(button("git-changes", this.git ? `Git · ${this.git.branch} · ${this.git.count || "✓"}` : "Git Changes", () => this.changes()))
      .child(button("git-lazygit", "LazyGit ↗", (_e, cx) => this.tool("lazygit", cx)));
  }
}
