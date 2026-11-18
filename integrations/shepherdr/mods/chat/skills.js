import { exec } from "herdr";

// Query Codex in the target project so its own discovery, enablement and precedence apply.
// Claude's personal and project skills are files; inspect their metadata without loading the body.
export const DISCOVER = String.raw`
import json, os, re, signal, subprocess, sys
from pathlib import Path

def timed_out(*_):
    raise TimeoutError("skill discovery timed out")

def codex(cwd):
    with subprocess.Popen(["codex", "app-server", "--listen", "stdio://"], cwd=cwd,
                          stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL, text=True) as proc:
        try:
            for request in (
                {"id": 1, "method": "initialize", "params": {"clientInfo": {"name": "shepherdr", "version": "1"}}},
                {"method": "initialized"},
                {"id": 2, "method": "skills/list", "params": {"cwds": [str(cwd)]}},
            ):
                print(json.dumps(request), file=proc.stdin, flush=True)
            for line in proc.stdout:
                response = json.loads(line)
                if response.get("id") != 2:
                    continue
                if "error" in response:
                    raise RuntimeError("Codex skills/list failed")
                yield from (skill for item in response["result"]["data"] for skill in item["skills"] if skill["enabled"])
                return
            raise RuntimeError("Codex app-server exited before returning skills")
        finally:
            if proc.poll() is None:
                proc.kill()

def claude(cwd):
    home = Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude")
    for folder in [*(p / ".claude" for p in (cwd, *cwd.parents)), home]:
        for path in sorted((folder / "skills").glob("*/SKILL.md")):
            with path.open(encoding="utf-8", errors="replace") as file:
                if file.readline().strip() != "---":
                    continue
                fields = {}
                for line in file:
                    if line.strip() == "---":
                        break
                    match = re.match(r"^([\w-]+):\s*(.*?)\s*$", line)
                    if match:
                        fields[match[1]] = match[2].strip("\"'")
            if fields.get("user-invocable", "").lower() != "false":
                yield {"name": fields.get("name") or path.parent.name,
                       "description": fields.get("description", ""), "path": str(path)}

signal.signal(signal.SIGALRM, timed_out)
signal.alarm(15)
cwd = Path(sys.argv[2] or Path.home()).resolve(strict=True)
source = codex(cwd) if sys.argv[1] == "codex" else claude(cwd)
print(json.dumps([{"name": s["name"], "about": s["description"][:140], "path": s["path"]} for s in source]))
`;

export async function catalog(kind, machine, cwd) {
  const result = await exec("python3", ["-c", DISCOVER, kind, cwd ?? ""], { on: machine });
  if (result.code !== 0) throw new Error("Skill discovery failed");
  const byName = new Map();
  for (const s of JSON.parse(result.stdout)) {
    if (/^[\w][\w:.-]*$/.test(s.name) && typeof s.path === "string" && !byName.has(s.name)) {
      byName.set(s.name, { ...s, skill: true });
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function typing(text) {
  return /(?:^|\s)\$([\w:.-]*)$/.exec(text)?.[1] ?? null;
}

export function references(text, list) {
  const names = new Set([...text.matchAll(/(?:^|\s)\$([\w:.-]+)(?=\s|$)/g)].map((m) => m[1]));
  return list.filter((s) => names.has(s.name));
}

const GUIDANCE = "Before planning or delegating, use any relevant skills available to your CLI in this project. Read the skill's SKILL.md and give applicable instructions to the worker that needs them. When you use a skill, name it briefly in your reply.";

export function skillTag(selected, guide = false) {
  const lines = [];
  if (guide) lines.push(GUIDANCE);
  if (selected?.length) {
    lines.push("Use these selected skills for this request. Read each SKILL.md before proceeding and follow its applicable instructions.");
    lines.push(...selected.map((s) => `- ${s.name}: ${JSON.stringify(s.path).replaceAll("<", "\\u003c")}`));
  }
  return lines.length ? `<herdr-skills>\n${lines.join("\n")}\n</herdr-skills>\n` : "";
}
