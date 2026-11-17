import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, shared, setShared, nextCommand } from "herdr";
import { TOOLS, panelIsOpen, togglePanel } from "./panels.js";

export default class LocalTools extends View {
  init(_props, cx) {
    if (shared("layout") === "shepherdr") {
      const current = shared("workspace.panels") ?? ["files", "changes"];
      const enabled = [...new Set([...current, ...TOOLS.map(tool => tool.id)])];
      if (JSON.stringify(current) !== JSON.stringify(enabled)) setShared("workspace.panels", enabled);
    }
    cx.spawn(async () => {
      for (;;) {
        const command = String(await nextCommand()).replace(/^local-tools\./, "");
        if (command.startsWith("toggle-")) togglePanel(command.slice(7));
      }
    });
  }

  render() {
    const t = theme();
    return h_flex().id("local-tools").size_full().min_w(0).px(4).gap(2).items_center()
      .bg(t.chrome).border_t(1).border_color(t.border).overflow_x_scrollbar()
      .children(TOOLS.map(tool => {
        const active = panelIsOpen(tool.id);
        return h_flex().id(`tool-${tool.id}`).h(22).flex_none().px(5).gap(4).items_center().rounded(5)
          .text_size(11).text_color(active ? t.foreground : t.muted).bg(active ? t.selected : t.chrome)
          .cursor_pointer().tooltip(`打开 / 收起 ${tool.label}`)
          .hover(s => s.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => { cx.stop_propagation(); togglePanel(tool.id); })
          .child(svg(tool.icon).size(13).flex_none()).child(div().child(tool.label));
      }));
  }
}
