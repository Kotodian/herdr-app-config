// A drag carries a reference only. Resolve it through the existing read-only TAPD mod
// at drop time, so credentials and the project's selection stay owned by that mod.
export function tapdReference(value) {
  if (value?.kind !== "tapd-bug" || !/^\d{1,20}$/.test(value.workspace ?? "") ||
      !/^\d{10,30}$/.test(value.id ?? "")) throw new Error("TAPD Bug 引用无效，请刷新 TAPD 面板后重试。");
  return { action: "detail", workspace: String(value.workspace), id: String(value.id) };
}

export function tapdSnapshot(data, ref) {
  if (String(data?.workspace_id) !== ref.workspace || String(data?.id) !== ref.id) throw new Error("TAPD 返回了不同的 Bug，请刷新后重试。");
  const url = `https://www.tapd.cn/${ref.workspace}/bugtrace/bugs/view/${ref.id}`;
  const title = String(data.title || "未命名缺陷").replace(/\s+/g, " ").slice(0, 160);
  const number = ref.id.slice(-9).replace(/^0+/, "") || ref.id;
  return { name: `TAPD #${number} · ${title}`, source: "tapd", url, bugId: ref.id, title, project: String(data.project ?? ""),
    text: [`# ${title}`, "", "Source: TAPD Bug", `URL: ${url}`, `Bug ID: ${ref.id}`,
      `Project: ${data.project ?? ""} (${ref.workspace})`, `State: ${data.status_label ?? data.status ?? ""}`,
      `Priority: ${data.priority_label ?? data.priority ?? ""}`, `Severity: ${data.severity ?? ""}`,
      `Owner: ${data.current_owner ?? ""}`, `Reporter: ${data.reporter ?? ""}`, `Updated: ${data.modified ?? ""}`,
      `Fetched: ${new Date().toISOString()}`, "", "## 缺陷描述", "", data.description || "（无描述）", ""].join("\n") };
}
