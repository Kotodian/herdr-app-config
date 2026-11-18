"""Development targets and production isolation, using only throwaway repositories."""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "mods/tasks/bin"))
from herdr_task import assistant_settings, commands, github, launch, settings, workflow
from herdr_task.base import Fail


class GitWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.git("init", "-q", "-b", "main")
        for key, value in (("user.name", "Workflow test"), ("user.email", "workflow@example.invalid"),
                           ("commit.gpgsign", "false")):
            self.git("config", key, value)
        self.git("commit", "-q", "--allow-empty", "-m", "baseline")
        self.git("branch", "dev")
        self.baseline = self.git("rev-parse", "main")
        self.store = SimpleNamespace(loc={"folder": str(self.repo), "kind": "repo"},
                                     ref=lambda t: f"TEST-{t['id']}", dirty=False)
        self.policy_path = self.root / "policy.json"
        self.policy_path.write_text(json.dumps({
            "version": 1, "development_branch": "dev", "production_branch": "main",
            "release_requires_user": True, "task_merge": "ask", "release_instruction": "上线",
        }))
        for target, name, value in ((workflow, "POLICY_PATH", str(self.policy_path)),
                                     (settings, "SETTINGS", str(self.root / "settings.json"))):
            p = patch.object(target, name, value)
            p.start()
            self.addCleanup(p.stop)

    def git(self, *args, cwd=None):
        result = subprocess.run(["git", "-C", str(cwd or self.repo), *args], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip()

    def task(self, base="main"):
        return {"id": 1, "state": "running", "mode": "worktree", "base": base,
                "base_set": True, "start": self.baseline, "branch": "task/1", "agents": []}

    def worktree(self):
        wt = self.root / "worktree"
        self.git("worktree", "add", "-q", "-b", "task/1", str(wt), "main")
        return wt

    def test_defaults_override_old_main_and_automatic_merge_settings(self):
        cfg = {"everywhere": {"tasks": {"base": "main", "merge": "auto"}}}
        Path(settings.SETTINGS).write_text(json.dumps(cfg))
        self.assertEqual(settings.settings_for(self.store)["tasks"]["base"], "dev")
        self.assertEqual(settings.merge_policy(self.store, {"set": {"merge": "auto"}}), "ask")
        resolved = assistant_settings.resolve([("everywhere", cfg["everywhere"])])
        self.assertEqual((resolved["tasks"]["base"], resolved["tasks"]["merge"]), ("dev", "ask"))

    def test_new_task_uses_dev_while_repo_has_main_checked_out(self):
        t = {"id": 1, "mode": "worktree"}
        commands.set_base(self.store, t, None, new=True)
        self.assertEqual(t["base"], "dev")
        self.assertTrue(t["base_set"])
        self.assertEqual(self.git("branch", "--show-current"), "main")

    def test_worker_removes_its_private_scratch_on_exit_and_preserves_other_files(self):
        sentinel = self.root / "other-task"
        sentinel.touch()
        for code in (0, 7, 143):
            with self.subTest(code=code):
                result = subprocess.run(
                    ["sh", "-c", launch.WORKER_SCRATCH, "scratch-test", "sh", "-c",
                     'test "$TMPDIR" = "$HERDR_WORKER_TMP" && touch "$TMPDIR/test-output" && '
                     'printf "%s\\n" "$TMPDIR" && exit "$1"', "child", str(code)],
                    env={**os.environ, "TMPDIR": str(self.root)}, capture_output=True, text=True)
                self.assertEqual(result.returncode, code, result.stderr)
                scratch = Path(result.stdout.strip())
                self.assertEqual(scratch.parent, self.root)
                self.assertFalse(scratch.exists())
                self.assertTrue(sentinel.is_file())

    def test_explicit_main_or_empty_base_is_refused(self):
        for branch in ("main", "", "origin/main", "feature/other"):
            with self.subTest(branch=branch), self.assertRaises(Fail):
                commands.set_base(self.store, {"id": 1, "mode": "worktree"}, branch, new=True)

    def test_missing_dev_does_not_fall_back_to_main(self):
        self.git("branch", "-D", "dev")
        with self.assertRaisesRegex(Fail, "dev"):
            commands.set_base(self.store, {"id": 1, "mode": "worktree"}, None, new=True)
        self.assertEqual(self.git("rev-parse", "main"), self.baseline)

    def test_equivalent_base_retarget_preserves_dirty_files_and_history(self):
        wt = self.worktree()
        (wt / "pending.txt").write_text("unfinished work\n")
        before = self.git("status", "--porcelain", cwd=wt)
        t = {**self.task(), "worktree": str(wt)}
        commands.set_base(self.store, t, "dev")
        self.assertEqual(t["base"], "dev")
        self.assertEqual(self.git("status", "--porcelain", cwd=wt), before)
        self.assertEqual((wt / "pending.txt").read_text(), "unfinished work\n")
        self.assertEqual(self.git("rev-parse", "HEAD", cwd=wt), self.baseline)

    def test_retarget_refuses_a_divergent_base_or_existing_pr(self):
        wt = self.worktree()
        t = {**self.task(), "worktree": str(wt), "pr": {"number": 1}}
        with self.assertRaises(Fail):
            commands.set_base(self.store, t, "dev")
        t.pop("pr")
        self.git("commit", "-q", "--allow-empty", "-m", "main changed")
        with self.assertRaises(Fail):
            commands.set_base(self.store, t, "dev")
        self.assertEqual(t["base"], "main")

    def test_main_target_is_blocked_before_any_merge_or_push(self):
        t = {**self.task(), "worktree": "/unused"}
        with patch.object(commands, "git", side_effect=AssertionError("git must not run")), \
             patch.object(commands, "pr_view", side_effect=AssertionError("GitHub must not run")), \
             patch.object(github, "pr_push", side_effect=AssertionError("push must not run")):
            for action in (lambda: commands.ff_merge(self.store, t),
                           lambda: commands.local_merge_msg(self.store, t),
                           lambda: commands.merge_now(self.store, t),
                           lambda: commands.finalize(self.store, t),
                           lambda: github.pr_open(self.store, t, "test/repo"),
                           lambda: launch.folder_for(self.store, {**t, "worktree": str(self.repo)})):
                with self.assertRaisesRegex(Fail, "dev"):
                    action()

    def test_accept_and_merge_refuse_main_before_contacting_agents(self):
        from contextlib import contextmanager
        t = {**self.task(), "state": "ready", "worktree": "/unused"}
        self.store.find = lambda _: t

        @contextmanager
        def opened(_):
            yield self.store

        with patch.object(commands, "open_store", opened), \
             patch.object(commands, "live_agents", side_effect=AssertionError("agents must not be contacted")):
            for action in (commands.cmd_accept, commands.cmd_merge):
                with self.assertRaisesRegex(Fail, "dev"):
                    action(argparse.Namespace(id=1))

    def test_actual_pr_target_is_checked_even_when_task_says_dev(self):
        t = {**self.task("dev"), "pr": {"number": 1, "repo": "test/repo"}}
        for target in ("main", None):
            with self.subTest(target=target), \
                 patch.object(commands, "pr_view", return_value={"state": "OPEN", "baseRefName": target}), \
                 patch.object(commands, "gh", side_effect=AssertionError("merge must not run")):
                with self.assertRaisesRegex(Fail, "dev"):
                    commands.merge_now(self.store, t)

    def test_dev_fast_forward_keeps_main_unchanged(self):
        wt = self.worktree()
        (wt / "feature.txt").write_text("tested feature\n")
        self.git("add", "feature.txt", cwd=wt)
        self.git("commit", "-q", "-m", "feat(test): add feature", cwd=wt)
        head = self.git("rev-parse", "HEAD", cwd=wt)
        self.assertTrue(commands.ff_merge(self.store, {**self.task("dev"), "worktree": str(wt)}))
        self.assertEqual(self.git("rev-parse", "dev"), head)
        self.assertEqual(self.git("rev-parse", "main"), self.baseline)

    def test_invalid_policy_fails_closed(self):
        self.policy_path.write_text("{broken")
        with self.assertRaises(Fail):
            workflow.require_task_base(self.task("main"))

    def test_explicit_hotfix_defaults_to_main_and_rejects_dev(self):
        task = {"id": 1, "mode": "worktree", "workflow": "hotfix"}
        commands.set_base(self.store, task, None, new=True)
        self.assertEqual(task["base"], "main")
        workflow.require_task_base(task)
        with self.assertRaises(Fail):
            workflow.require_base("dev", task)

    def test_hotfix_actual_pr_target_must_be_main(self):
        task = {**self.task("main"), "workflow": "hotfix", "pr": {"number": 1, "repo": "test/repo"}}
        with patch.object(commands, "pr_view", return_value={"state": "OPEN", "baseRefName": "dev"}), \
             patch.object(commands, "gh", side_effect=AssertionError("must not merge")):
            with self.assertRaisesRegex(Fail, "main"):
                commands.merge_now(self.store, task)

    def test_hotfix_fast_forward_updates_main_only(self):
        self.git("switch", "-q", "dev")
        wt = self.worktree()
        self.git("commit", "-q", "--allow-empty", "-m", "fix(test): production bug", cwd=wt)
        task = {**self.task("main"), "workflow": "hotfix", "worktree": str(wt)}
        self.assertTrue(commands.ff_merge(self.store, task))
        self.assertEqual(self.git("rev-parse", "dev"), self.baseline)
        self.assertEqual(self.git("rev-parse", "main"), self.git("rev-parse", "HEAD", cwd=wt))

    def test_in_place_task_cannot_bypass_branch_policy(self):
        with self.assertRaisesRegex(Fail, "dev"):
            launch.folder_for(self.store, {"mode": "here"})
        self.assertEqual(launch.folder_for(self.store, {"mode": "here", "workflow": "hotfix"}), str(self.repo))


if __name__ == "__main__":
    unittest.main()
