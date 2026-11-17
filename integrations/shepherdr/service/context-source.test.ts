import { expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sourceAttachment } from "./context-source.ts";

test("web source attachment writes the snapshot and returns a normal deliverable path", async () => {
  const dir = await mkdtemp(join(tmpdir(), "context-source-"));
  try {
    const file = await sourceAttachment({ kind: "github", url: "org/repo#1" }, async () => ({
      code: 0, stdout: JSON.stringify({ title: "Requirement", body: "Exact body", comments: 0 }),
    }), dir);
    expect(file.path.startsWith(dir + "/web-")).toBe(true);
    expect(file.name).toContain("GitHub Issue · #1 Requirement");
    expect(await readFile(file.path, "utf8")).toContain("Exact body");
    await expect(sourceAttachment({ kind: "lark", url: "invalid" }, async () => { throw new Error("must not run"); }, dir)).rejects.toThrow();
    expect(await readdir(dir)).toHaveLength(1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
