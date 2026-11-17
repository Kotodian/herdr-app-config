import { describe, expect, test } from "bun:test";
import { fetchSource, sourceRef, githubRepo, spaceIssues, spaceIssue } from "./context-source.js";

const ok = (value) => ({ code: 0, stdout: JSON.stringify(value), stderr: "" });

describe("composer context sources", () => {
  test("current Space repository accepts GitHub HTTPS and SSH origins only", () => {
    for (const value of ["https://github.com/org/repo.git", "git@github.com:org/repo.git", "ssh://git@github.com/org/repo.git"]) expect(githubRepo(value)).toBe("org/repo");
    for (const value of ["https://evil.test/org/repo", "/tmp/org/repo", "git@github.com:org/repo;cmd", "https://github.com/org/repo/issues/1"]) expect(() => githubRepo(value)).toThrow();
  });
  test("Issue list resolves this folder, reads every page, and excludes PRs", async () => {
    const calls = [];
    const out = await spaceIssues("/repo with spaces", async (cmd, args) => {
      calls.push([cmd, ...args]);
      return cmd === "git" ? { code: 0, stdout: "git@github.com:org/current.git\n" } : ok([
        [{ number: 2, title: "Bug", updated_at: "today" }, { number: 3, pull_request: {} }],
        [{ number: 4, title: "Feature" }],
      ]);
    });
    expect(calls[0]).toEqual(["git", "-C", "/repo with spaces", "remote", "get-url", "origin"]);
    expect(calls[1]).toContain("--paginate");
    expect(out.repo).toBe("org/current");
    expect(out.issues.map((x) => x.number)).toEqual([2, 4]);
  });
  test("a mismatched Issue never reaches the GitHub API", async () => {
    const calls = [];
    await expect(spaceIssue("org/other#12", "/repo", async (cmd) => { calls.push(cmd); return { code: 0, stdout: "git@github.com:org/current.git" }; })).rejects.toThrow("当前 Space");
    expect(calls).toEqual(["git"]);
  });
  test("GitHub links and shorthand normalize to an issue", () => {
    expect(sourceRef("github", "org/repo#12").url).toBe("https://github.com/org/repo/issues/12");
    expect(sourceRef("github", " https://github.com/org/repo/issues/12?x=1#issuecomment-2 ").repo).toBe("org/repo");
  });
  test("Wiki and Docx links retain selections; route by path on shared domains", () => {
    for (const url of ["https://team.feishu.cn/wiki/Ab123", "https://team.larksuite.com/docx/Ab123#share-123", "https://doubao.com/docx/Ab123"]) {
      expect(sourceRef("lark", url).url).toBe(url);
    }
  });
  test("invalid references fail before executing a program", async () => {
    for (const [kind, url] of [
      ["github", "https://evil.test/org/repo/issues/1"], ["github", "https://github.com/org/repo/pull/1"],
      ["github", "https://u:p@github.com/org/repo/issues/1"], ["github", "org/repo#1;echo bad"],
      ["lark", "file:///docx/Ab12"], ["lark", "https://team.feishu.cn/base/Ab12"], ["shell", "foo"],
    ]) {
      let ran = false;
      await expect(fetchSource(kind, url, async () => { ran = true; return ok({}); })).rejects.toThrow();
      expect(ran).toBe(false);
    }
  });
  test("issue body, labels and every discussion page reach the snapshot", async () => {
    const calls = [];
    const result = await fetchSource("github", "org/repo#12", async (cmd, args) => {
      calls.push([cmd, ...args]);
      return calls.length === 1 ? ok({ title: "修复登录", body: "原始需求", state: "open", user: { login: "author" }, labels: [{ name: "bug" }], comments: 2 })
        : ok([[{ body: "第一页意见", user: { login: "one" } }], [{ body: "第二页意见", user: { login: "two" } }]]);
    });
    expect(calls[1]).toContain("--paginate");
    expect(calls[1]).toContain("--slurp");
    for (const text of ["修复登录", "原始需求", "bug", "第一页意见", "第二页意见", result.url]) expect(result.text).toContain(text);
    expect(result.name).toBe("GitHub Issue · #12 修复登录");
  });
  test("an issue without comments does not request discussions", async () => {
    let calls = 0;
    await fetchSource("github", "org/repo#12", async () => { calls++; return ok({ title: "Empty", comments: 0 }); });
    expect(calls).toBe(1);
  });
  test("a PR is rejected without attaching it as an issue", async () => {
    await expect(fetchSource("github", "org/repo#12", async () => ok({ pull_request: {} }))).rejects.toThrow("Pull Request");
  });
  test("Feishu snapshot preserves content, resource map, comments and tips", async () => {
    let args;
    const result = await fetchSource("lark", "https://team.feishu.cn/wiki/Ab12", async (_cmd, argv) => {
      args = argv;
      return ok({ ok: true, data: { document: { content: "# 需求说明\n\n正文", reference_map: { comments: { c1: { data: "原始评论" } }, image: { img: { token: "token" } } }, tips: "资源读取提示" } } });
    });
    expect(args).toEqual(["docs", "+fetch", "--doc", result.url, "--doc-format", "markdown", "--as", "user"]);
    expect(result.title).toBe("需求说明");
    for (const text of ["正文", "原始评论", "token", "资源读取提示"]) expect(result.text).toContain(text);
  });
  test("authentication, malformed output and empty documents are actionable failures", async () => {
    await expect(fetchSource("github", "org/repo#12", async () => ({ code: 1, stderr: "not logged in", stdout: "" }))).rejects.toThrow("gh 登录");
    await expect(fetchSource("lark", "https://team.feishu.cn/docx/Ab12", async () => ok({ ok: false, error: { message: "permission denied" } }))).rejects.toThrow("permission denied");
    await expect(fetchSource("lark", "https://team.feishu.cn/docx/Ab12", async () => ok({ ok: true, data: { document: { content: "" } } }))).rejects.toThrow("正文");
    await expect(fetchSource("lark", "https://team.feishu.cn/docx/Ab12", async () => { throw new Error("ENOENT"); })).rejects.toThrow("安装并登录");
  });
});
