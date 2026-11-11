import { View, svg } from "gpui-kit";
import { Button, h_flex } from "gpui-base";
import { theme, layout, shared, setShared, nextCommand } from "herdr";
import { commitLayout, walkLayout } from "./layout.js";

const MAP = {
  id: "agenttrail",
  label: "Map",
  mod: "agenttrail",
  icon: "mods/kanso-chrome/icons/chart.svg",
  props: {
    command: [
      "/opt/homebrew/opt/node@24/bin/node",
      "__HERDR_SYNC_HOME__/.local/lib/node_modules/agenttrail/bin/agenttrail.mjs"
    ]
  }
};

export default class AgenttrailEntry extends View {
  init(_props, cx) {
    const current = shared("kanso.panels");
    const panels = Array.isArray(current) ? current : [];
    const next = panels.some(p => p.id === MAP.id)
      ? panels.map(p => p.id === MAP.id ? MAP : p)
      : [...panels, MAP];
    if (JSON.stringify(next) !== JSON.stringify(panels)) setShared("kanso.panels", next);
    cx.spawn(async () => {
      for (;;) {
        const command = String(await nextCommand()).replace(/^local-agenttrail-entry\./, "");
        if (command === "open") this.open();
        if (command === "toggle") this.toggle();
      }
    });
  }

  open() {
    commitLayout({ panel: { id: MAP.id, type: "block", content: { mod: MAP.mod, props: MAP.props } } });
  }

  toggle() {
    const body = walkLayout(layout(), "panel-body");
    const showing = body && !body.hidden && body.children?.[0]?.content?.mod === MAP.mod;
    if (showing) commitLayout({ panel: null });
    else this.open();
  }

  render() {
    const t = theme();
    return Button.new("agenttrail-entry").size_full().items_center().justify_center().rounded(6).cursor_pointer()
      .accessibility_label("打开 Agent 工作进度").tooltip("Agenttrail · Agent 工作进度")
      .hover(s => s.bg(t.hover)).focus(s => s.bg(t.selected)).on_click(() => this.toggle())
      .child(h_flex().gap(6).items_center().text_size(11.5).text_color(t.muted)
        .child(svg(MAP.icon).size(13)).child("Map"));
  }
}
