// Composer sources. Both clients use authenticated local CLIs and attach a snapshot;
// fetching never sends a chat message or writes to the source.
export const SOURCES = [
  { id: "github", label: "GitHub Issue", placeholder: "https://github.com/owner/repo/issues/123", icon: "github" },
  { id: "lark", label: "飞书文档", placeholder: "https://…/docx/… 或 https://…/wiki/…", icon: "lark" },
];

export function sourceRef(kind, value) {
  const raw = String(value ?? "").trim();
  if (!SOURCES.some((s) => s.id === kind)) throw new Error("请选择 GitHub Issue 或飞书文档。");
  if (kind === "github") {
    const short = /^([\w.-]+)\/([\w.-]+)#([1-9]\d*)$/.exec(raw);
    if (short) return { kind, repo: `${short[1]}/${short[2]}`, number: short[3], url: `https://github.com/${short[1]}/${short[2]}/issues/${short[3]}` };
  }
  let u;
  try { u = new URL(raw); } catch { throw new Error("请粘贴完整的链接。"); }
  if (u.protocol !== "https:" || u.username || u.password || u.port) throw new Error("请使用 HTTPS 文档或 Issue 链接。");
  if (kind === "github") {
    const m = /^\/([\w.-]+)\/([\w.-]+)\/issues\/([1-9]\d*)\/?$/.exec(u.pathname);
    if (u.hostname !== "github.com" || !m) throw new Error("请输入 GitHub Issue 链接，或 owner/repo#123。");
    return { kind, repo: `${m[1]}/${m[2]}`, number: m[3], url: `https://github.com/${m[1]}/${m[2]}/issues/${m[3]}` };
  }
  // Route by path: Lark also supports shared Docx/Wiki URLs on other domains.
  if (!/^\/(?:docx|wiki)\/[A-Za-z0-9]+\/?$/.test(u.pathname)) throw new Error("请输入飞书 /docx/ 或 /wiki/ 文档链接。");
  return { kind, url: u.toString() };
}

async function jsonCommand(run, command, args) {
  let r;
  try { r = await run(command, args); }
  catch { throw new Error(command === "gh" ? "无法运行 gh，请先安装并执行 gh auth login。" : "无法运行 lark-cli，请先安装并登录飞书。"); }
  let j;
  try { j = JSON.parse(r.stdout); } catch {}
  if (r.code !== 0 || !j || j.ok === false) {
    const detail = j?.error?.message ?? j?.error ?? r.stderr ?? "";
    const hint = command === "gh" ? "请检查 gh 登录状态及仓库权限。" : "请检查 lark-cli 登录状态及文档权限。";
    throw new Error(`${hint}${detail ? ` ${String(detail).trim().slice(0, 600)}` : ""}`);
  }
  return j;
}

export function githubRepo(remote) {
  const raw = String(remote ?? "").trim();
  const m = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+)\/([\w.-]+?)\/?$/.exec(raw);
  if (!m) throw new Error("当前 Space 没有 GitHub origin 仓库。");
  return `${m[1]}/${m[2].replace(/\.git$/, "")}`;
}

export async function spaceRepo(folder, run) {
  if (!folder) throw new Error("当前对话没有 Space 仓库。");
  const r = await run("git", ["-C", folder, "remote", "get-url", "origin"]);
  if (r.code !== 0) throw new Error("当前 Space 不是 Git 仓库，或没有 origin。");
  return githubRepo(r.stdout);
}

export async function spaceIssues(folder, run) {
  const repo = await spaceRepo(folder, run);
  const pages = await jsonCommand(run, "gh", ["api", "--paginate", "--slurp",
    `repos/${repo}/issues?state=open&sort=updated&direction=desc&per_page=100`]);
  if (!Array.isArray(pages)) throw new Error("GitHub Issue 列表格式异常，请重试。");
  const issues = pages.flat().filter((x) => !x.pull_request && Number.isInteger(x.number) && x.number > 0).map((x) => ({
    number: x.number, title: String(x.title ?? ""), state: x.state, updated: x.updated_at,
    url: `https://github.com/${repo}/issues/${x.number}`,
  }));
  return { repo, issues };
}

export async function spaceIssue(value, folder, run) {
  const ref = sourceRef("github", value);
  const repo = await spaceRepo(folder, run);
  if (repo.toLowerCase() !== ref.repo.toLowerCase()) throw new Error("请选择当前 Space 仓库中的 Issue。");
  return fetchSource("github", ref.url, run);
}

export async function fetchSource(kind, value, run) {
  const ref = sourceRef(kind, value);
  let title, content;
  if (kind === "github") {
    const issue = await jsonCommand(run, "gh", ["api", `repos/${ref.repo}/issues/${ref.number}`]);
    if (issue.pull_request) throw new Error("这是 Pull Request，请选择 GitHub Issue。");
    title = `#${ref.number} ${issue.title ?? ""}`.trim();
    const labels = (issue.labels ?? []).map((l) => typeof l === "string" ? l : l.name).filter(Boolean);
    const pages = issue.comments > 0
      ? await jsonCommand(run, "gh", ["api", "--paginate", "--slurp", `repos/${ref.repo}/issues/${ref.number}/comments?per_page=100`]) : [];
    const comments = pages.flat();
    content = [`Repository: ${ref.repo}`, `State: ${issue.state ?? ""}`, `Author: ${issue.user?.login ?? ""}`,
      ...(labels.length ? [`Labels: ${labels.join(", ")}`] : []), "", issue.body || "（无正文）",
      ...(comments.length ? ["", "## 讨论", ...comments.flatMap((c) => ["", `### ${c.user?.login ?? "unknown"} · ${c.created_at ?? ""}`, c.html_url ?? "", "", c.body ?? ""])] : [])].join("\n");
  } else {
    const reply = await jsonCommand(run, "lark-cli", ["docs", "+fetch", "--doc", ref.url, "--doc-format", "markdown", "--as", "user"]);
    const doc = reply.data?.document;
    if (typeof doc?.content !== "string" || !doc.content.trim()) throw new Error("文档未返回可读取的正文，请检查链接和访问权限。");
    title = doc.title || doc.content.split("\n").map((s) => s.replace(/^#+\s*/, "").trim()).find(Boolean) || "飞书文档";
    content = doc.content;
    // Preserve the sidecar: Markdown alone omits comment anchors and resource metadata.
    if (doc.reference_map && Object.keys(doc.reference_map).length) content += `\n\n## 引用资源与评论\n\n\`\`\`json\n${JSON.stringify(doc.reference_map, null, 2)}\n\`\`\``;
    if (doc.tips) content += `\n\n## 读取提示\n\n${typeof doc.tips === "string" ? doc.tips : JSON.stringify(doc.tips)}`;
  }
  title = String(title).replace(/\s+/g, " ").slice(0, 160);
  const label = SOURCES.find((s) => s.id === kind).label;
  const text = `# ${title}\n\nSource: ${label}\nURL: ${ref.url}\nFetched: ${new Date().toISOString()}\n\n${content}\n`;
  if (text.length > 8 * 1024 * 1024) throw new Error("内容超过 8 MB，请改用较小的文档。");
  return { kind, url: ref.url, title, name: `${label} · ${title}`, text };
}
