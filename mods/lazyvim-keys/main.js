import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { closeOverlay, layout, props, run, spaces, theme } from "herdr";

function findNode(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const match = findNode(child, id);
    if (match) return match;
  }
}

function togglePanel(id, name) {
  const tree = layout();
  const panel = findNode(tree, "panel");
  const stack = findNode(panel, "panel-body");
  if (!stack?.children?.some(child => child.id === id)) {
    return run("tab.new", { mod: id, name });
  }
  if (!panel.hidden && stack.active === id) return run("layout.hide", { id: "panel" });
  run("layout.select", { stack: "panel-body", child: id });
  return run("layout.show", { id: "panel" });
}

function activeSpace() {
  return spaces().find(space => space.active);
}

function selectTab(tab) {
  if (tab) run("tab.select", { id: tab.id });
}

function openLazygit() {
  const executable = activeSpace()?.machine ? "lazygit" : "/opt/homebrew/bin/lazygit";
  return run("terminal.open", { argv: [executable], name: "LazyGit" });
}

const group = (label, keys) => ({ label, keys });
const action = (label, execute) => ({ label, execute });
const command = (label, name, args) => action(label, () => run(name, args));

const KEYS = {
  h: command("Focus left pane", "pane.go", { direction: "left" }),
  j: command("Focus lower pane", "pane.go", { direction: "down" }),
  k: command("Focus upper pane", "pane.go", { direction: "up" }),
  l: command("Focus right pane", "pane.go", { direction: "right" }),
  H: command("Previous tab", "tab.prev"),
  L: command("Next tab", "tab.next"),
  "[": group("Previous", { b: command("Previous tab", "tab.prev") }),
  "]": group("Next", { b: command("Next tab", "tab.next") }),
  "-": command("Split down", "pane.split", { direction: "down" }),
  "|": command("Split right", "pane.split", { direction: "right" }),
  w: group("Windows", {
    d: command("Close pane", "pane.close"),
    m: command("Zoom pane", "pane.zoom"),
  }),
  b: group("Buffers", {
    b: command("Jump to a tab or space", "mod.open", { name: "picker" }),
    d: command("Close tab", "tab.close"),
  }),
  tab: group("Tabs", {
    tab: command("New tab", "tab.new"),
    "[": command("Previous tab", "tab.prev"),
    "]": command("Next tab", "tab.next"),
    f: action("First tab", () => selectTab(activeSpace()?.tabs[0])),
    l: action("Last tab", () => selectTab(activeSpace()?.tabs.at(-1))),
    d: command("Close tab", "tab.close"),
  }),
  " ": command("Jump to a space, task or artifact", "mod.open", { name: "jump" }),
  e: action("Files panel", () => togglePanel("files", "Files")),
  f: group("Find and terminal", {
    f: action("Browse files", () => togglePanel("files", "Files")),
    b: command("Find a tab or space", "mod.open", { name: "picker" }),
    t: command("New terminal tab", "terminal.open"),
  }),
  g: group("Git", {
    g: action("LazyGit", openLazygit),
    s: action("Git changes", () => togglePanel("changes", "Git Changes")),
  }),
  s: group("Search", {
    c: command("Command palette", "app.palette"),
    k: command("Herdr keybinds", "mod.open", { name: "keybinds" }),
    b: command("Search terminal history", "terminal.search"),
  }),
  u: group("Interface", {
    B: command("Toggle sidebar", "layout.toggle", { id: "sidebar" }),
    Z: command("Zoom pane", "pane.zoom"),
  }),
  q: group("Quit", { q: command("Quit Herdr", "app.quit") }),
};

const keyLabel = key => ({ " ": "Space", tab: "Tab" })[key] ?? key;

function pressedKey(event) {
  if (event.key === "tab") return "tab";
  if (event.key === "space") return " ";
  if (event.modifiers.shift && event.key === "\\") return "|";
  if (event.modifiers.shift && /^[a-z]$/.test(event.key)) return event.key.toUpperCase();
  return event.key_char || event.key;
}

export default class LazyVimKeys extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.menu = group("LazyVim Keys", KEYS);
  }

  select(entry, cx) {
    if (entry.keys) {
      this.menu = entry;
      cx.notify();
      return;
    }
    closeOverlay(props().overlay);
    entry.execute();
  }

  render() {
    const colors = theme();
    const entries = Object.entries(this.menu.keys);
    const middle = Math.ceil(entries.length / 2);
    const columns = [entries.slice(0, middle), entries.slice(middle)];
    return v_flex().id("lazyvim-keys").track_focus(this.handle).size_full().min_h(0)
      .p(12).gap(8).text_size(13).text_color(colors.foreground)
      .on_key_down((event, cx) => {
        if (event.modifiers.control || event.modifiers.alt || event.modifiers.platform) return;
        cx.stop_propagation();
        if (event.is_held) return;
        if (event.key === "escape") return closeOverlay(props().overlay);
        if (event.key === "backspace") {
          this.menu = group("LazyVim Keys", KEYS);
          return cx.notify();
        }
        const key = pressedKey(event);
        const entry = Object.hasOwn(this.menu.keys, key) && this.menu.keys[key];
        if (entry) this.select(entry, cx);
      })
      .child(div().text_size(14).child(this.menu.label))
      .child(h_flex().h(middle * 27).flex_none().gap(8).children(columns.map((column, index) =>
        v_flex().id(`lazyvim-key-list-${index}`).flex_1().min_w(0)
          .children(column.map(([key, entry]) =>
            h_flex().id(`lazyvim-key-${keyLabel(key)}`).flex_none().h(27).px(6).gap(8)
              .items_center().rounded(4).cursor_pointer().hover(style => style.bg(colors.hover))
              .on_click((_event, cx) => this.select(entry, cx))
              .child(div().w(38).text_color(colors.accent).child(keyLabel(key)))
              .child(div().child(entry.label))
              .children(entry.keys ? [div().ml_auto().text_color(colors.dim).child("›")] : []))))))
      .child(div().text_size(11).text_color(colors.dim).child("Esc to close · Backspace to go back"));
  }
}
