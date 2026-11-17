import { test, expect } from "bun:test";
import { closeIssue } from "./actions.js";

function runner(issue = { number: 12, state: "open" }) {
  const writes = [];
  return {
    writes,
    run: async (cmd, args) => {
      if (cmd === "git") return { code: 0, stdout: "git@github.com:owner/repo.git" };
      if (args.includes("PATCH")) {
        writes.push(args);
        return { code: 0, stdout: JSON.stringify({ number: 12, state: "closed" }) };
      }
      return { code: 0, stdout: JSON.stringify(issue) };
    },
  };
}
test("close uses captured Space origin and selected close reason", async () => {
  const r = runner();
  expect((await closeIssue("https://github.com/owner/repo/issues/12", "/repo", r.run, "not_planned")).state).toBe("closed");
  expect(r.writes[0]).toContain("state_reason=not_planned");
  expect(r.writes[0]).toContain("repos/owner/repo/issues/12");
});
test("another repository and PR are rejected without mutation", async () => {
  const r = runner();
  await expect(closeIssue("https://github.com/elsewhere/repo/issues/12", "/repo", r.run)).rejects.toThrow("当前 Space");
  expect(r.writes).toHaveLength(0);
  const pr = runner({ number: 12, state: "open", pull_request: {} });
  await expect(closeIssue("owner/repo#12", "/repo", pr.run)).rejects.toThrow("Issue");
  expect(pr.writes).toHaveLength(0);
});
test("already closed is idempotent and an unknown reason cannot write", async () => {
  const r = runner({ number: 12, state: "closed" });
  expect((await closeIssue("owner/repo#12", "/repo", r.run)).state).toBe("closed");
  await expect(closeIssue("owner/repo#12", "/repo", r.run, "arbitrary")).rejects.toThrow("原因");
  expect(r.writes).toHaveLength(0);
});
test("a denied mutation returns an error instead of reporting success", async () => {
  const r = runner();
  const run = async (cmd, args) => args.includes("PATCH") ? { code: 1, stdout: "{}" } : r.run(cmd, args);
  await expect(closeIssue("owner/repo#12", "/repo", run)).rejects.toThrow("写入权限");
});
