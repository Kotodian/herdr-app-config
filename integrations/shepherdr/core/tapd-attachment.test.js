import { test, expect } from "bun:test";
import { tapdReference, tapdSnapshot } from "./tapd-attachment.js";

test("TAPD drag resolves a Bug reference without a Space or project mapping", () => {
  const ref = tapdReference({ kind: "tapd-bug", workspace: "12345678", id: "1123456789000" });
  expect(ref).toEqual({ action: "detail", workspace: "12345678", id: "1123456789000" });
  const out = tapdSnapshot({ workspace_id: ref.workspace, id: ref.id, title: "登录失败", project: "客户端",
    status_label: "处理中", current_owner: "我", description: "复现步骤与预期结果" }, ref);
  for (const s of ["登录失败", "客户端", "处理中", "复现步骤与预期结果", out.url, ref.id]) expect(out.text).toContain(s);
  expect(out.source).toBe("tapd");
  expect(out).toMatchObject({ bugId: ref.id, title: "登录失败", project: "客户端" });
  expect(out.name).toBe("TAPD #456789000 · 登录失败");
  expect(out.url).toBe(`https://www.tapd.cn/${ref.workspace}/bugtrace/bugs/view/${ref.id}`);
});

test("invalid references and mismatched details are rejected", () => {
  for (const ref of [{}, { kind: "tapd-bug", workspace: "../bad", id: "1123456789000" }, { kind: "tapd-bug", workspace: "123", id: "3;echo" }]) expect(() => tapdReference(ref)).toThrow();
  expect(() => tapdSnapshot({ id: "1123456789001", workspace_id: "123" }, { workspace: "123", id: "1123456789000" })).toThrow("不同的 Bug");
});
