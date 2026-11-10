import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, props, closeOverlay, hc } from "herdr";

export default class ToolWindow extends View {
  init() { this.address = props()?.terminal; }
  async close() {
    // Only the terminal created for this tool window belongs to this mod.
    if (this.address) await hc(["kill", this.address]);
  }
  render() {
    const t = theme(), p = props() ?? {};
    return h_flex().id("tool-titlebar").size_full().px(12).gap(10).items_center().bg(t.chrome).text_color(t.foreground).text_size(12)
      .child(div().flex_1().truncate().child(p.title || "工具"))
      .child(div().id("tool-close").px(10).py(4).rounded(5).cursor_pointer().hover(s => s.bg(t.hover))
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click(() => closeOverlay(p.overlay)).child("关闭 ✕"));
  }
}
