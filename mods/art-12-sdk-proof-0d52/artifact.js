// Written by herdr-artifact each time this artifact is installed. Don't edit: it's replaced.
import { hc } from "herdr";

export const id = "12-sdk-proof-0d52";
export const title = "SPS-5: \u6309\u8bbe\u8ba1\u7b2c12\u8282\u91cd\u6574 SDK \u76ee\u5f55 \u00b7 Proof";
export const version = 2;
/** The newest version when this one was installed (an older version shows only when picked). */
export const latest = 2;
export const folder = "__HERDR_SYNC_HOME__/go/src/github.com/Kotodian/steam-proxy-sdk";
/** The machine the artifact (and its agent) is on, null for this one. */
export const machine = null;
/** This mod's folder, for image() and svg(): asset("chart.svg") -> "mods/art-12-sdk-proof-0d52/chart.svg". */
export const dir = "mods/art-12-sdk-proof-0d52";
export const asset = (name) => `${dir}/${name}`;
/** The agent that made it (a terminal address), or null. */
export const agent = "t5n";
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
