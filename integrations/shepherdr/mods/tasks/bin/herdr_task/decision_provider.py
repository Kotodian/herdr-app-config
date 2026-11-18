"""Read the selected agent's provider and call its native classification endpoint."""

import json
import os
from pathlib import Path
import shutil
import subprocess

from .base import Fail

# TOML parsing and the request stay in one process. Provider credentials never
# appear in argv, stdout, stored decisions or synchronized application files.
REQUEST = r"""
import { join } from "node:path";
import { homedir } from "node:os";
const input = await Bun.stdin.json();
let url, headers = {};
try {
  if (input.agent === "codex") {
    const root = process.env.CODEX_HOME || join(homedir(), ".codex");
    const config = Bun.TOML.parse(await Bun.file(join(root, "config.toml")).text());
    const profile = config.profiles?.[config.profile] ?? {};
    const p = config.model_providers?.[profile.model_provider ?? config.model_provider];
    url = p?.base_url;
    headers = { ...p?.http_headers };
    const token = p?.experimental_bearer_token || (p?.env_key ? process.env[p.env_key] : null);
    if (token) headers.Authorization = "Bearer " + token;
  } else {
    const root = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
    const config = await Bun.file(join(root, "settings.json")).json();
    const env = { ...config.env, ...process.env };
    url = env.ANTHROPIC_BASE_URL;
    // Bili wraps Claude's Messages API; its embedded provider URL serves
    // the model catalog and System One directly.
    const wrapped = typeof url === "string" && url.match(/\/bili\/(https?:\/\/.+)$/);
    if (wrapped) url = wrapped[1];
    const token = env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY;
    if (token) headers.Authorization = "Bearer " + token;
    headers["anthropic-version"] = "2023-06-01";
  }
  if (!url) throw new Error();
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
} catch {
  console.error("The selected agent has no readable custom provider URL.");
  process.exit(1);
}
try {
  const base = url.replace(/\/+$/, "").replace(/\/v1$/, "");
  headers["Content-Type"] = "application/json";
  headers["Cache-Control"] = "no-cache";
  if (input.path === "models") headers["X-Magpie-Deciders"] = "1";
  const response = await fetch(base + "/v1/" + input.path, {
    method: input.body ? "POST" : "GET", headers,
    body: input.body ? JSON.stringify(input.body) : undefined,
    signal: AbortSignal.timeout(input.body ? 120000 : 10000),
  });
  if (!response.ok) {
    console.error("Decision provider returned HTTP " + response.status + ".");
    process.exit(1);
  }
  console.log(JSON.stringify(await response.json()));
} catch {
  console.error("Could not reach the decision provider or read its JSON response.");
  process.exit(1);
}
"""


def request(agent, path, body=None):
    bun = shutil.which("bun")
    if not bun:
        candidate = Path.home() / ".bun/bin/bun"
        if candidate.is_file():
            bun = str(candidate)
    if not bun:
        raise Fail("Bun is required to read the decision provider configuration.")
    try:
        p = subprocess.run([bun, "-e", REQUEST], input=json.dumps({"agent": agent, "path": path, "body": body}),
                           capture_output=True, text=True, timeout=135 if body else 15,
                           env={k: v for k, v in os.environ.items() if not k.startswith(("HC_", "CLAUDE_CODE_"))})
    except (OSError, subprocess.TimeoutExpired):
        raise Fail("Decision provider could not be reached. No task was created.")
    if p.returncode:
        raise Fail((p.stderr.strip() or "Decision provider failed.") + " No task was created.")
    try:
        return json.loads(p.stdout)
    except (ValueError, TypeError):
        raise Fail("Decision provider returned invalid JSON. No task was created.")


def typesafe_model(model):
    return isinstance(model, str) and model.startswith("typesafe/jev")


def models():
    for agent in ("codex", "claude"):
        try:
            value = request(agent, "models")
            rows = value.get("data", []) if isinstance(value, dict) else []
            found = [{"id": m["id"], "name": "Typesafe · " + m["id"].split("/", 1)[1]}
                     for m in rows if isinstance(m, dict) and typesafe_model(m.get("id"))
                     and m.get("kind") == "decision"]
            if found:
                return list({m["id"]: m for m in found}.values())
        except Fail:
            pass
    return []


def cmd_models(args):
    from .output import say
    found = models()
    say(args, {"models": found}, "\n".join(m["name"] + "  " + m["id"] for m in found))


KINDS = {
    "bug": "现有行为不符合预期，包括缺陷报告、回归和修复请求。",
    "feature": "新增能力或有意调整现有行为。",
}


def classification(pick, context, instructions):
    questions = {
        "task_type": {"type": "choice", "instructions": "判断现有行为是否有缺陷，或用户是否在提出新能力或行为调整。",
                      "criteria": KINDS},
    }
    response = request(pick["agent"], "systemone", {"model": pick["model"],
                       "state": {"request": context, "instructions": instructions}, "questions": questions})
    answers = response.get("answers") if isinstance(response, dict) else None
    answer = answers.get("task_type") if isinstance(answers, dict) else None
    kind = answer.get("choice") if isinstance(answer, dict) else None
    if not isinstance(kind, str) or kind not in KINDS:
        raise Fail("Typesafe must return bug or feature.")
    return {"task_type": kind}
