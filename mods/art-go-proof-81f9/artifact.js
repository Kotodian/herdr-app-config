// Written by herdr-artifact each time this artifact is installed. Don't edit: it's replaced.
import { hc } from "herdr";

export const id = "go-proof-81f9";
export const title = "SPS-8: \u8865\u9f50\u7f51\u7edc\u53d8\u5316\u4e0e Go \u884c\u4e3a\u5bf9\u9f50 \u00b7 Proof";
export const version = 2;
/** The newest version when this one was installed (an older version shows only when picked). */
export const latest = 2;
export const folder = "__HERDR_SYNC_HOME__/go/src/github.com/Kotodian/steam-proxy-sdk";
/** The machine the artifact (and its agent) is on, null for this one. */
export const machine = null;
/** This mod's folder, for image() and svg(): asset("chart.svg") -> "mods/art-go-proof-81f9/chart.svg". */
export const dir = "mods/art-go-proof-81f9";
export const asset = (name) => `${dir}/${name}`;
/** The agent that made it (a terminal address), or null. */
export const agent = "t5z";
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
