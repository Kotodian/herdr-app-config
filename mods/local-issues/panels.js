// Source for the local integrations' panel bridge. Run sync-panels.py after edits.
import { layout, run, shared } from "herdr";

export const TOOLS = [
  { id: "magpie", label: "Magpie", mod: "local-magpie", icon: "mods/local-magpie/magpie.svg" },
  { id: "komari", label: "Komari", mod: "local-komari", icon: "mods/kanso-chrome/icons/server.svg" },
  { id: "gitview", label: "Gitview", mod: "gitview", icon: "mods/kanso-chrome/icons/changes.svg" },
  { id: "cloudflare", label: "Cloudflare", mod: "local-cloudflare", icon: "mods/local-cloudflare/icon.svg" },
  { id: "tapd", label: "TAPD", mod: "local-tapd", icon: "mods/local-tapd/icon.svg" },
  { id: "issues", label: "Issues", mod: "local-issues", icon: "mods/local-issues/github.svg" },
  { id: "agenttrail", label: "Map", mod: "agenttrail", icon: "mods/kanso-chrome/icons/chart.svg" },
];

export function walkLayout(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = walkLayout(child, id);
    if (found) return found;
  }
  return null;
}

function workspace() {
  const tree = layout();
  // A layout switch can expose the previous tree briefly; never write into that tree.
  if (shared("layout") !== "shepherdr" || walkLayout(tree, "local-tools-entry")?.content?.mod !== "local-tools") return null;
  const body = walkLayout(tree, "panel-body"), panel = walkLayout(tree, "panel");
  return body?.type === "stack" && panel ? { body, panel } : null;
}

export function panelIsOpen(id) {
  const place = workspace();
  return Boolean(place && !place.panel.hidden && place.body.active === id);
}

export function commitLayout(patch) {
  const place = workspace();
  if (!place || !Object.prototype.hasOwnProperty.call(patch, "panel")) return false;
  const child = patch.panel;
  if (!child) {
    if (!TOOLS.some(tool => tool.id === place.body.active)) return false;
    run("layout.hide", { id: "panel" });
    return true;
  }
  const tool = TOOLS.find(tool => tool.id === child.id && tool.mod === child.content?.mod);
  const slot = place.body.children?.find(node => node.id === tool?.id);
  if (!tool || slot?.content?.mod !== tool.mod) return false;
  // Select the existing slot. Replacing the stack would discard Tasks, PR and Artifacts.
  run("layout.select", { stack: "panel-body", child: tool.id });
  run("layout.show", { id: "panel" });
  return true;
}

export function togglePanel(id) {
  const tool = TOOLS.find(tool => tool.id === id);
  if (!tool) return false;
  return commitLayout({ panel: panelIsOpen(id) ? null : { id, content: { mod: tool.mod } } });
}
