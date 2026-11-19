"""Decision routing and chosen-model calls; no real provider, agents or user settings."""

import argparse
from contextlib import contextmanager
import importlib.util
import json
from pathlib import Path
import subprocess
from types import SimpleNamespace
from unittest.mock import patch
import unittest

spec = importlib.util.spec_from_file_location("workflow_tests", Path(__file__).with_name("git-workflow.test.py"))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
from herdr_task import commands, debugger, decision, decision_provider, settings
from herdr_task.base import Fail


class DecisionTests(fixture.GitWorkflowTests):
    # Reuse the throwaway repo setup, not the base class's test methods.
    def setUp(self):
        super().setUp()
        self.pick = {"agent": "codex", "model": "custom/my-choice", "effort": "high", "fast": False}
        Path(settings.SETTINGS).write_text(json.dumps({"everywhere": {"decider": self.pick}}))
        self.loc = self.store.loc
        self.store.new = self.new
        self.created = []
        self.locked = False

    def new(self, title, prompt, mode):
        t = {"id": 1, "title": title, "prompt": prompt, "mode": mode, "state": "todo", "agents": []}
        self.created.append(t)
        return t

    def args(self, **extra):
        defaults = dict(title="增加功能", prompt="完整需求", prompt_file=None,
                        folder=str(self.repo), space="space-test", base=None,
                        here=False, worktree=False, after=None, branch=None,
                        start_notes=None, finish_notes=None)
        return argparse.Namespace(**{**defaults, **extra})

    @contextmanager
    def opened(self, _):
        self.locked = True
        try:
            yield self.store
        finally:
            self.locked = False

    def add(self, record, **extra):
        def prepare(*_):
            self.assertFalse(self.locked, "classification must happen outside the store lock")
            return record
        with patch.object(commands, "open_store", self.opened), \
             patch.object(decision, "prepare", side_effect=prepare), \
             patch.object(commands, "worktrees_on", return_value=True), \
             patch.object(commands, "view", side_effect=lambda s, t: dict(t)), \
             patch.object(commands, "say"):
            commands.cmd_add(self.args(**extra))
        return self.created[-1]

    def record(self, kind="feature"):
        return {"version": decision.VERSION, "at": 1, "model": self.pick,
                "request_hash": decision.fingerprint(self.loc, "增加功能", "完整需求"),
                "result": {"task_type": kind}}

    def test_choice_inherits_independently_for_folder(self):
        cfg = {"everywhere": {"decider": self.pick, "worker": {"model": "worker-only"}},
               "spaces": {"space-test": {"folder": str(self.repo),
                                         "decider": {**self.pick, "model": "space-choice"}}}}
        Path(settings.SETTINGS).write_text(json.dumps(cfg))
        self.assertEqual(decision.selection(self.loc, "space-test")["model"], "space-choice")
        self.assertEqual(decision.selection(self.loc)["model"], "space-choice")
        self.assertEqual(settings.settings_for(self.store)["worker"]["model"], "worker-only")

    def test_unset_does_not_silently_choose_a_model(self):
        Path(settings.SETTINGS).write_text("{}")
        self.assertIsNone(decision.prepare(self.args(), "完整需求"))
        with self.assertRaisesRegex(Fail, "No decision model selected"):
            decision.classify(self.loc, "hello")

    def test_selected_model_and_readonly_boundary_are_used(self):
        def run(argv, **kw):
            self.assertEqual(argv[argv.index("-m") + 1], "custom/my-choice")
            self.assertIn("mcp_servers={}", argv)
            self.assertIn('approval_policy="never"', argv)
            self.assertEqual(argv[argv.index("-s") + 1], "read-only")
            self.assertNotEqual(kw["cwd"], str(self.repo))
            self.assertIn("完整需求", kw["input"])
            Path(argv[argv.index("--output-last-message") + 1]).write_text('{"task_type":"feature"}')
            return SimpleNamespace(returncode=0, stdout="", stderr="")
        with patch.object(decision.subprocess, "run", side_effect=run):
            record = decision.classify(self.loc, "增加功能", "完整需求")
        self.assertEqual(record["model"]["model"], "custom/my-choice")
        self.assertEqual(record["result"], {"task_type": "feature"})

    def test_claude_model_has_no_tools_or_hooks(self):
        cmd = decision.model_command({**self.pick, "agent": "claude"}, "/tmp/test")
        self.assertEqual(cmd[cmd.index("--tools") + 1], "")
        self.assertIn("--strict-mcp-config", cmd)
        self.assertEqual(json.loads(cmd[cmd.index("--settings") + 1]),
                         {"disableAllHooks": True, "fastMode": False})
        self.assertEqual(cmd[cmd.index("--model") + 1], self.pick["model"])

    def test_only_bug_and_feature_labels_are_accepted(self):
        for kind in ("bug", "feature"):
            self.assertEqual(decision.validate({"task_type": kind}), {"task_type": kind})
        for value in ({}, {"task_type": "hotfix"}, {"task_type": "release"}, {"task_type": []},
                      {"task_type": "bug", "workflow": "hotfix"},
                      {"task_type": "feature", "requires_review": True}):
            with self.subTest(value=value), self.assertRaises(Fail):
                decision.validate(value)

    def test_failure_never_creates_task_or_falls_back(self):
        with patch.object(decision, "locate", return_value=self.loc), \
             patch.object(decision.subprocess, "run", return_value=SimpleNamespace(returncode=1, stderr="unavailable")):
            with self.assertRaisesRegex(Fail, "No task was created"):
                decision.prepare(self.args(), "完整需求")
        self.assertFalse(self.created)

    def test_feature_uses_development_default_without_overriding_settings(self):
        task = self.add(self.record())
        self.assertEqual(task["base"], "dev")
        self.assertNotIn("workflow", task)
        self.assertEqual(task["decision"]["result"], {"task_type": "feature"})
        self.assertFalse(task.get("set"))

    def test_assistant_hotfix_uses_main_without_changing_checked_out_branch(self):
        self.git("switch", "-q", "dev")
        task = self.add(self.record("bug"), workflow="hotfix", base="main")
        self.assertEqual(task["workflow"], "hotfix")
        self.assertEqual(task["decision"]["result"], {"task_type": "bug"})
        self.assertEqual(task["base"], "main")
        self.assertEqual(self.git("branch", "--show-current"), "dev")
        commands.require_task_base(task)
        with self.assertRaises(Fail):
            commands.require_base("dev", task)

    def test_classifier_cannot_choose_the_branch_of_a_bug_fix_on_its_own(self):
        for title in ("修复线上缺陷", "修复 dev 上的缺陷", "修复登录缺陷"):
            with self.assertRaisesRegex(Fail, "Confirm where the defect occurs"):
                self.add(self.record("bug"), title=title)
        self.assertFalse(self.created)

    def test_dev_and_worker_bugs_keep_the_development_base(self):
        for title in ("修复 dev 上的登录缺陷", "修复 Worker 开发中的缺陷", "Fix main menu scrolling"):
            with self.subTest(title=title):
                task = self.add(self.record("bug"), title=title, workflow="development")
                self.assertEqual((task["workflow"], task["base"]), ("development", "dev"))

    def test_debugger_reads_main_without_switching_or_creating_a_branch(self):
        self.git("switch", "-q", "dev")
        self.git("commit", "-q", "--allow-empty", "-m", "dev only")
        dev_commit = self.git("rev-parse", "dev")
        self.git("branch", "-f", "main", self.baseline)
        before = self.git("branch", "--list")
        real_run = subprocess.run

        def run_debug(argv, **kwargs):
            if argv[0] != "codex":
                return real_run(argv, **kwargs)
            self.assertEqual(argv[argv.index("-s") + 1], "read-only")
            self.assertIn('approval_policy="never"', argv)
            self.assertIn(self.baseline, kwargs["input"])
            self.assertEqual(kwargs["cwd"], self.repo.resolve())
            Path(argv[argv.index("--output-last-message") + 1]).write_text("main 缺陷根因与证据")
            return SimpleNamespace(returncode=0, stderr="")

        with patch.object(debugger.subprocess, "run", side_effect=run_debug), patch.object(debugger, "say") as report:
            debugger.cmd_debug(self.args(prompt="已确认 main 有登录缺陷", main_commit=self.baseline, headless=True))
            with self.assertRaisesRegex(Fail, "reachable from main"):
                debugger.cmd_debug(self.args(prompt="已确认 main 有登录缺陷", main_commit=dev_commit, headless=True))
        self.assertEqual(report.call_args.args[1]["main_commit"], self.baseline)
        self.assertEqual(self.git("branch", "--list"), before)

    def test_debugger_starts_visible_readonly_child_in_the_reported_checkout(self):
        with patch.dict(debugger.os.environ, {"HC_TERMINAL_ID": "t6"}), \
             patch.object(debugger, "settings_for", return_value={"debugger": {"agent": "codex", "model": "gpt-5", "effort": "high", "perm": "full"}}), \
             patch.object(debugger, "run", return_value=SimpleNamespace(stdout='{"address":"t7"}')) as run, \
             patch.object(debugger, "say") as report:
            debugger.cmd_debug(self.args(prompt="已确认 main 有登录缺陷", main_commit=self.baseline))
        argv = run.call_args.args[0]
        split = argv.index("--")
        self.assertEqual(argv[:4], ["hc", "run", "--bg", "--json"])
        self.assertEqual(argv[argv.index("--parent") + 1], "t6")
        self.assertEqual(argv[argv.index("--cwd") + 1], str(self.repo.resolve()))
        self.assertIn("herdr.role=debugger", argv[:split])
        self.assertIn("read-only", argv[split:])
        self.assertEqual(argv[argv.index("--model") + 1], "gpt-5")
        self.assertIn('model_reasoning_effort="high"', argv[split:])
        self.assertNotIn("full", argv[split:])
        self.assertTrue(any('trust_level="untrusted"' in arg for arg in argv))
        self.assertIn(self.baseline, argv[-1])
        self.assertEqual(report.call_args.args[1]["terminal"], "t7")

    def test_debugger_targets_dev_and_rejects_other_branches(self):
        self.git("switch", "-q", "dev")
        self.git("commit", "-q", "--allow-empty", "-m", "dev defect")
        dev_commit = self.git("rev-parse", "dev")
        with patch.dict(debugger.os.environ, {"HC_TERMINAL_ID": "t6"}), \
             patch.object(debugger, "visible_debugger", return_value="t7") as launch, \
             patch.object(debugger, "say") as report:
            debugger.cmd_debug(self.args(prompt="Defect on dev", branch="dev", commit=dev_commit))
            self.assertIn(f"Affected dev revision: {dev_commit}", launch.call_args.args[2])
            self.assertEqual(report.call_args.args[1]["branch"], "dev")
            self.assertEqual(report.call_args.args[1]["commit"], dev_commit)
            with self.assertRaisesRegex(Fail, "only investigates dev or main"):
                debugger.cmd_debug(self.args(prompt="Defect on a worker branch", branch="task/example"))
            self.assertEqual(launch.call_count, 1)

    def test_cached_decision_reuse_is_bound_to_request_and_folder(self):
        path = self.root / "decision.json"
        path.write_text(json.dumps(self.record()))
        with patch.object(decision, "classify", side_effect=AssertionError("must not call model twice")):
            record = decision.prepare(self.args(decision_file=str(path)), "完整需求")
            self.assertEqual(record["result"], {"task_type": "feature"})
            with self.assertRaisesRegex(Fail, "different request"):
                decision.prepare(self.args(decision_file=str(path)), "changed")
            old = {**self.record(), "version": 1,
                   "result": {"task_type": "hotfix", "workflow": "hotfix"}}
            path.write_text(json.dumps(old))
            with self.assertRaisesRegex(Fail, "older classification format"):
                decision.prepare(self.args(decision_file=str(path)), "完整需求")
            self.assertEqual(decision.words({"decision": old}), ["- Previous classification: hotfix"])

    def test_typesafe_calls_selected_agent_provider_and_preserves_choice(self):
        for agent in ("codex", "claude"):
            pick = {"agent": agent, "model": "typesafe/jev-latest"}
            Path(settings.SETTINGS).write_text(json.dumps({"everywhere": {"decider": pick}}))
            def request(chosen, endpoint, body):
                self.assertEqual(chosen, agent)
                self.assertEqual(endpoint, "systemone")
                self.assertEqual(body["model"], pick["model"])
                self.assertIn("request", body["state"])
                self.assertEqual(list(body["questions"]), ["task_type"])
                self.assertEqual(set(body["questions"]["task_type"]["criteria"]), {"bug", "feature"})
                return {"answers": {"task_type": {"choice": "bug"}}}
            with patch.object(decision_provider, "request", side_effect=request), \
                 patch.object(decision.subprocess, "run", side_effect=AssertionError("must not launch a coding CLI")):
                record = decision.classify(self.loc, "修复线上登录bug")
            self.assertEqual(record["model"]["agent"], agent)
            self.assertEqual(record["result"], {"task_type": "bug"})

    def test_typesafe_discovery_keeps_only_native_typesafe_decision_models(self):
        rows = [{"id": "typesafe/jev-latest", "kind": "decision"},
                {"id": "typesafe/jev-preview", "kind": "decision"},
                {"id": "typesafe/jev-router", "kind": "chat"},
                {"id": "other/decision", "kind": "decision"}]
        with patch.object(decision_provider, "request", return_value={"data": rows}):
            self.assertEqual([m["id"] for m in decision_provider.models()],
                             ["typesafe/jev-latest", "typesafe/jev-preview"])

    def test_typesafe_invalid_answers_are_refused(self):
        pick = {"agent": "codex", "model": "typesafe/jev-preview"}
        for answers in ({}, {"task_type": {"choice": "release"}}, {"task_type": {"choice": []}}):
            with patch.object(decision_provider, "request", return_value={"answers": answers}), self.assertRaises(Fail):
                decision_provider.classification(pick, {}, "rules")


# Avoid rerunning the fixture's inherited tests in this module.
for name in dir(fixture.GitWorkflowTests):
    if name.startswith("test_") and name not in DecisionTests.__dict__:
        setattr(DecisionTests, name, None)


if __name__ == "__main__":
    unittest.main()
