"""Run a separate read-only diagnosis in the reported project's checkout."""

import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from types import SimpleNamespace
from uuid import uuid4

from .base import Fail, git, run
from .decision import request_prompt
from .github import remote_of
from .output import say
from .settings import TEMPLATES, settings_for
from .templates import FRONT


def model_args(folder):
    ok, root, _ = git(folder, "rev-parse", "--show-toplevel")
    pick = settings_for(SimpleNamespace(loc={"folder": root if ok else str(folder)})).get("debugger") or {}
    if not isinstance(pick, dict) or pick.get("agent") != "codex":
        return []
    model, effort = pick.get("model"), pick.get("effort")
    args = ["--model", model] if isinstance(model, str) and re.fullmatch(r"[\w./:\[\]-]{1,200}", model) else []
    if isinstance(effort, str) and re.fullmatch(r"[\w-]{1,60}", effort):
        args += ["-c", f"model_reasoning_effort={json.dumps(effort)}"]
    return args


def visible_debugger(folder, parent, message):
    name = f"debugger-{uuid4().hex[:8]}"
    _, root, _ = git(folder, "rev-parse", "--show-toplevel")
    # A session override keeps project config disabled without changing saved trust.
    paths = dict.fromkeys((str(folder), root or str(folder)))
    projects = "projects={" + ",".join(f'{json.dumps(path)}={{trust_level="untrusted"}}' for path in paths) + "}"
    result = run(["hc", "run", "--bg", "--json", "--parent", parent, "--name", name, "--cwd", str(folder),
                  "--label", "herdr.role=debugger", "--label", "herdr.agent=codex", "--",
                  "codex", "--no-daemon", "--sandbox", "read-only", "--ask-for-approval", "never", *model_args(folder),
                  "-c", projects, "-c", "mcp_servers={}", "-c", 'web_search="disabled"',
                  "--disable", "hooks", "--disable", "apps", "--disable", "plugins",
                  "--disable", "multi_agent", "--no-alt-screen", "--", message], check=True)
    try:
        return json.loads(result.stdout)["address"]
    except (ValueError, TypeError, KeyError):
        raise Fail("Could not read the address of the Debugger terminal.")


def cmd_debug(args):
    folder = Path(args.folder or os.getcwd()).expanduser().resolve()
    if not folder.is_dir():
        raise Fail(f"Debugger folder does not exist: {folder}")
    symptom = request_prompt(args).strip()
    if not symptom:
        raise Fail("Provide the bug symptoms with --prompt or --prompt-file.")
    branch = getattr(args, "branch", None) or "main"
    if branch not in ("dev", "main"):
        raise Fail("Debugger only investigates dev or main.")
    legacy_commit = getattr(args, "main_commit", None)
    if legacy_commit and branch != "main":
        raise Fail("Use --commit with --branch dev.")
    branch_tip = None
    for ref in (f"refs/remotes/{remote_of(folder)}/{branch}", f"refs/heads/{branch}"):
        ok, commit, _ = git(folder, "rev-parse", "--verify", f"{ref}^{{commit}}")
        if ok:
            branch_tip = commit
            break
    if not branch_tip:
        raise Fail(f"Debugger needs a repository with a local or fetched {branch} branch.")
    affected_commit = branch_tip
    reported_commit = getattr(args, "commit", None) or legacy_commit
    if reported_commit:
        if (not re.fullmatch(r"[0-9a-fA-F]{40}|[0-9a-fA-F]{64}", reported_commit)
                or not git(folder, "merge-base", "--is-ancestor", reported_commit, branch_tip)[0]):
            raise Fail(f"The affected commit must be a full SHA reachable from {branch}.")
        affected_commit = reported_commit.lower()
    template = Path(TEMPLATES, "debugger.md")
    if not template.is_file():
        template = Path(__file__).resolve().parents[4] / "templates" / "debugger.md"
    instructions = FRONT.sub("", template.read_text(), count=1)
    message = (f"{instructions}\n\nAffected {branch} revision: {affected_commit}\n"
               f"Branch reference: {ref} at {branch_tip}\n\nReported symptoms and context:\n{symptom}\n")
    target = {"folder": str(folder), "branch": branch, "commit": affected_commit}
    if branch == "main":
        target["main_commit"] = affected_commit
    parent = os.environ.get("HC_TERMINAL_ID")
    if parent and not getattr(args, "headless", False):
        address = visible_debugger(folder, parent, message)
        say(args, {**target, "terminal": address},
            f"Debugger started at {address}. Check startup with `hc read {address}`. "
            f"If it shows Folder access, select Open restricted. Use `hc wait {address}` for the report.")
        return
    with tempfile.TemporaryDirectory(prefix="shepherdr-debugger-") as scratch:
        report = Path(scratch, "report.md")
        argv = ["codex", "exec", "--ephemeral", "--skip-git-repo-check", "--ignore-rules",
                "-C", str(folder), "-s", "read-only", "-c", 'approval_policy="never"',
                "-c", "mcp_servers={}", "-c", 'web_search="disabled"',
                "--output-last-message", str(report), *model_args(folder)]
        for feature in ("hooks", "apps", "plugins", "multi_agent"):
            argv.extend(("--disable", feature))
        try:
            result = subprocess.run([*argv, "-"], input=message, cwd=folder, text=True,
                                    capture_output=True, timeout=600)
        except subprocess.TimeoutExpired:
            raise Fail("Debugger timed out before returning a diagnosis.")
        if result.returncode or not report.is_file():
            reason = result.stderr.strip().splitlines()
            raise Fail("Debugger could not return a diagnosis." + (f" {reason[-1]}" if reason else ""))
        findings = report.read_text().strip()
        if not findings:
            raise Fail("Debugger returned an empty diagnosis.")
    say(args, {**target, "report": findings}, findings)
