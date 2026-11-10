// Registers upstream gitview in kanso's native panel catalog.
import { View, div, svg } from "gpui-kit";
import { Button, h_flex } from "gpui-base";
import { theme, shared, setShared, nextCommand, layout, run, spaces, panes, focused } from "herdr";
import { commitLayout, walkLayout } from "./layout.js";

export default class GitviewEntry extends View {
  init(_props, cx) {
    const old = Array.isArray(shared("kanso.panels")) ? shared("kanso.panels") : [];
    const entry = { id: "gitview", label: "Gitview", mod: "gitview", icon: "mods/kanso-chrome/icons/changes.svg" };
    const list = old.some(p => p.id === "gitview") ? old.map(p => p.id === "gitview" ? entry : p) : [...old, entry];
    if (JSON.stringify(list) !== JSON.stringify(old)) setShared("kanso.panels", list);
    this.was = null;
    cx.timer.every(300, () => this.reconcile());
    cx.spawn(async cx => {
      for (;;) {
        const command = String(await nextCommand()).replace(/^local-gitview-entry\./, "");
        if (command === "toggle") this.toggle();
        if (command === "open") this.show();
      }
    });
  }
  showing() {
    const body = walkLayout(layout(), "panel-body");
    return Boolean(body && !body.hidden && body.children?.[0]?.content?.mod === "gitview");
  }
  show() {
    commitLayout({ panel: { id: "gitview", type: "block", content: { mod: "gitview" } } });
  }
  toggle() {
    if (shared("layout") !== "kanso") return;
    if (!this.showing()) this.show();
    else {
      this.closeDiffs(focused()?.tab);
      const space = spaces().find(s => s.active);
      if (space) run(`gitview.hidden:${space.id}`);
      commitLayout({ panel: null });
    }
  }
  closeDiffs(tab) {
    const own = new Set(Object.values(shared("gitview.own") ?? {}));
    if (!tab || own.has(tab)) return;
    for (const p of panes()) if (p.tab === tab && p.mod === "gitview-diff") run("pane.close", { pane: p.pane });
  }
  reconcile() {
    const next = { open: this.showing(), tab: focused()?.tab, space: spaces().find(s => s.active)?.id };
    // An on-demand panel unmounts when another panel is selected. Remove only
    // gitview's diff panes; terminal and editor panes always stay untouched.
    if (this.was?.open && !next.open && this.was.space === next.space) this.closeDiffs(this.was.tab);
    this.was = next;
  }
  render() {
    const t = theme();
    return Button.new("gitview-entry").size_full().items_center().justify_center().rounded(6).cursor_pointer()
      .accessibility_label("打开 Gitview").tooltip("Gitview · ⌘⇧G 面板 / ⌘G 独立标签")
      .hover(s => s.bg(t.hover)).focus(s => s.bg(t.selected)).on_click(() => this.toggle())
      .child(h_flex().gap(6).items_center().text_size(11.5).text_color(t.muted)
        .child(svg("mods/kanso-chrome/icons/changes.svg").size(13)).child("Gitview"));
  }
}
