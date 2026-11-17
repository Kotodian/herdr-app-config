import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { fetchSource } from "../core/context-source.js";

type Runner = (command: string, args: string[]) => Promise<{ code: number; stdout: string; stderr?: string }>;

/** Same local snapshot as the native composer. It enters the normal attachment delivery path. */
export async function sourceAttachment(body: unknown, run: Runner, dir: string) {
  const b = body as { kind?: unknown; url?: unknown } | null;
  if (!b || typeof b.kind !== "string" || typeof b.url !== "string" || b.url.length > 4096) throw new Error("请输入 Issue 或飞书文档链接。");
  const source = await fetchSource(b.kind, b.url, run);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `web-${randomUUID()}-${source.kind}.md`);
  await Bun.write(path, source.text);
  return { path, name: `${source.name}.md` };
}
