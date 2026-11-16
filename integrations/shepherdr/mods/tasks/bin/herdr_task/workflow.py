"""The user's synchronized development/release policy, separate from task runtime data."""

import json
import os

from .base import APP_HOME, Fail

POLICY_PATH = os.path.join(APP_HOME, "git-workflow.json")


def policy():
    try:
        with open(POLICY_PATH) as f:
            value = json.load(f)
    except FileNotFoundError:
        return None
    except (OSError, ValueError) as e:
        raise Fail(f"Can't read the Git workflow policy: {e}")
    if (not isinstance(value, dict) or value.get("version") != 1
            or value.get("development_branch") != "dev"
            or value.get("production_branch") != "main"
            or value.get("release_requires_user") is not True
            or value.get("task_merge") != "ask"):
        raise Fail("Invalid Git workflow policy; expected dev first, explicit production releases, and task merge ask.")
    if value.get("hotfix_from_production", True) is not True:
        raise Fail("Git workflow must preserve the user's main-to-main hotfix exception.")
    return value


def apply_defaults(settings):
    if policy():
        settings["tasks"].update(base="dev", merge="ask")
    return settings


def task_base(task=None):
    """The workflow, rather than the checked-out branch, chooses a code task's base."""
    return "main" if (task or {}).get("workflow") == "hotfix" else "dev"


def require_base(branch, task=None):
    expected = task_base(task)
    if policy() and branch != expected:
        raise Fail(f"Git workflow: this task must branch from and merge into {expected}, "
                   f"not {branch or 'an unset branch'}. Ordinary development uses dev; "
                   "an explicitly classified main bug fix uses --workflow hotfix (main to main). "
                   "Only an explicit user instruction to 上线 authorizes a separate dev-to-main release or deployment.")


def require_task_base(task):
    if task.get("mode") == "worktree":
        require_base(task.get("base") or "main", task)


def require_folder(task, folder):
    """A repo task working in-place follows the same branch rule as worktrees."""
    if task.get("mode") != "worktree" and policy():
        from .base import git
        ok, branch, _ = git(folder, "branch", "--show-current")
        if ok:
            require_base(branch, task)
