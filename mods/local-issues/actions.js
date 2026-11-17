import { sourceRef, spaceRepo } from "./context-source.js";

async function api(run, args) {
  const result = await run("gh", ["api", ...args]);
  let data;
  try { data = JSON.parse(result.stdout); } catch {}
  if (result.code !== 0 || !data) throw new Error("GitHub 操作失败，请检查 gh 登录和 Issue 写入权限，刷新后确认结果。");
  return data;
}

export async function closeIssue(value, folder, run, reason = "completed") {
  if (!["completed", "not_planned"].includes(reason)) throw new Error("关闭原因无效。");
  const ref = sourceRef("github", value);
  const repo = await spaceRepo(folder, run);
  if (repo.toLowerCase() !== ref.repo.toLowerCase()) throw new Error("只能关闭当前 Space 仓库的 Issue。");
  const endpoint = `repos/${repo}/issues/${ref.number}`;
  const issue = await api(run, [endpoint]);
  if (issue.pull_request || issue.number !== Number(ref.number)) throw new Error("请选择有效的 GitHub Issue。");
  if (issue.state === "closed") return issue;
  const saved = await api(run, ["--method", "PATCH", endpoint,
    "--raw-field", "state=closed", "--raw-field", `state_reason=${reason}`]);
  if (saved.number !== Number(ref.number) || saved.state !== "closed") throw new Error("关闭结果未确认，请刷新 Issue 后查看。");
  return saved;
}
