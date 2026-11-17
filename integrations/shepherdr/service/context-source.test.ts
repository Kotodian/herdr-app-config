import { expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sourceAttachment } from "./context-source.ts";

test("web source attachment writes the snapshot and returns a normal deliverable path", async () => {
  const dir = await mkdtemp(join(tmpdir(), "context-source-"));
  try {
    const file = await sourceAttachment({ kind: "github", url: "org/repo#1" }, async (cmd) => ({
      code: 0, stdout: cmd === "git" ? "git@github.com:org/repo.git" : JSON.stringify({ title: "Requirement", body: "Exact body", comments: 0 }),
    }), dir, "/repo");
    expect(file.path.startsWith(dir + "/web-")).toBe(true);
    expect(file.name).toContain("GitHub Issue · #1 Requirement");
    expect(await readFile(file.path, "utf8")).toContain("Exact body");
    await expect(sourceAttachment({ kind: "lark", url: "invalid" }, async () => { throw new Error("must not run"); }, dir)).rejects.toThrow();
    expect(await readdir(dir)).toHaveLength(1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("GitHub attachments require a known Space and reject a different repository", async () => {
  const runner = async () => ({ code: 0, stdout: "git@github.com:org/current.git" });
  await expect(sourceAttachment({ kind: "github", url: "org/other#1" }, runner, "/unused", "/repo")).rejects.toThrow("当前 Space");
  await expect(sourceAttachment({ kind: "github", url: "org/current#1" }, runner, "/unused")).rejects.toThrow("Space 仓库");
});
