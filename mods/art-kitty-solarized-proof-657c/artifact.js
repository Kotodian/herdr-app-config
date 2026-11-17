// Written by herdr-artifact each time this artifact is installed. Don't edit: it's replaced.
import { hc } from "herdr";

export const id = "kitty-solarized-proof-657c";
export const title = "KIT-1: \u4e0b\u8f7d\u5e76\u6539\u9020 Kitty Solarized \u78e8\u7802\u4e3b\u9898 \u00b7 Proof";
export const version = 4;
/** The newest version when this one was installed (an older version shows only when picked). */
export const latest = 4;
export const folder = "/private/tmp/kitty-appearance-work";
/** The machine the artifact (and its agent) is on, null for this one. */
export const machine = null;
/** This mod's folder, for image() and svg(): asset("chart.svg") -> "mods/art-kitty-solarized-proof-657c/chart.svg". */
export const dir = "mods/art-kitty-solarized-proof-657c";
export const asset = (name) => `${dir}/${name}`;
/** The agent that made it (a terminal address), or null. */
export const agent = "t68";
/** A custom panel (its own main.js), not a recipe: the window keeps a picture of it for the web app. */
export const custom = false;

/** Sends text to the agent that made this artifact, as a message it reads like the person's.
 *  Resolves true when it was delivered, false when that agent is gone. Call it from a click. */
export async function reply(text) {
  if (!agent) return false;
  const body = `<hc from="artifact" id="${id}" version="${version}" title=${JSON.stringify(title)}>\n${text}\n</hc>`;
  const r = await hc(["send", agent, body]);
  return r.code === 0;
}
