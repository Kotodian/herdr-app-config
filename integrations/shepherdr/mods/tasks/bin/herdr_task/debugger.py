"""Run a separate read-only diagnosis in the reported project's checkout."""

import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from uuid import uuid4

from .base import Fail, git, run
from .decision import request_prompt
from .github import remote_of
from .output import say
from .settings import TEMPLATES
from .templates import FRONT


def visible_debugger(folder, parent, message):
    name = f"debugger-{uuid4().hex[:8]}"
    _, root, _ = git(folder, "rev-parse", "--show-toplevel")
    # A session override keeps project config disabled without changing saved trust.
    paths = dict.fromkeys((str(folder), root or str(folder)))
    projects = "projects={" + ",".join(f'{json.dumps(path)}={{trust_level="untrusted"}}' for path in paths) + "}"
    result = run(["hc", "run", "--bg", "--json", "--parent", parent, "--name", name, "--cwd", str(folder),
                  "--label", "herdr.role=debugger", "--label", "herdr.agent=codex", "--",
                  "codex", "--no-daemon", "--sandbox", "read-only", "--ask-for-approval", "never",
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
    main_commit = None
    for ref in (f"refs/remotes/{remote_of(folder)}/main", "refs/heads/main"):
        ok, commit, _ = git(folder, "rev-parse", "--verify", f"{ref}^{{commit}}")
        if ok:
            main_commit = commit
            break
    if not main_commit:
        raise Fail("Debugger needs a repository with a local or fetched main branch.")
    main_tip = main_commit
    reported_commit = getattr(args, "main_commit", None)
    if reported_commit:
        if (not re.fullmatch(r"[0-9a-fA-F]{40}|[0-9a-fA-F]{64}", reported_commit)
                or not git(folder, "merge-base", "--is-ancestor", reported_commit, main_tip)[0]):
            raise Fail("The affected commit must be a full SHA reachable from main.")
        main_commit = reported_commit.lower()
    template = Path(TEMPLATES, "debugger.md")
    if not template.is_file():
        template = Path(__file__).resolve().parents[4] / "templates" / "debugger.md"
    instructions = FRONT.sub("", template.read_text(), count=1)
    message = (f"{instructions}\n\nAffected main revision: {main_commit}\n"
               f"Main reference: {ref} at {main_tip}\n\nReported symptoms and context:\n{symptom}\n")
    parent = os.environ.get("HC_TERMINAL_ID")
    if parent and not getattr(args, "headless", False):
        address = visible_debugger(folder, parent, message)
        say(args, {"folder": str(folder), "main_commit": main_commit, "terminal": address},
            f"Debugger started at {address}. Check startup with `hc read {address}`. "
            f"If it shows Folder access, select Open restricted. Use `hc wait {address}` for the report.")
        return
    with tempfile.TemporaryDirectory(prefix="shepherdr-debugger-") as scratch:
        report = Path(scratch, "report.md")
        argv = ["codex", "exec", "--ephemeral", "--skip-git-repo-check", "--ignore-rules",
                "-C", str(folder), "-s", "read-only", "-c", 'approval_policy="never"',
                "-c", "mcp_servers={}", "-c", 'web_search="disabled"',
                "--output-last-message", str(report)]
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
    say(args, {"folder": str(folder), "main_commit": main_commit, "report": findings}, findings)
