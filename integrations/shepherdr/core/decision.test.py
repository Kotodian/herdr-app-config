"""Decision routing and chosen-model calls; no real provider, agents or user settings."""

import argparse
from contextlib import contextmanager
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import unittest

spec = importlib.util.spec_from_file_location("workflow_tests", Path(__file__).with_name("git-workflow.test.py"))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
from herdr_task import commands, decision, decision_provider, settings
from herdr_task.base import Fail


def result(**overrides):
    return {
        "task_type": "development", "workflow": "development", "execution": "implement",
        "risk": "medium", "complexity": "medium", "production_bug": False,
        "requires_review": True, "requires_proof": True, "needs_clarification": False,
        "steps": ["实现并独立评审"], "verification": ["验证新旧行为"], "questions": [],
        "reason": "新功能先在开发分支验证。", **overrides,
    }


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
        return argparse.Namespace(title="增加功能", prompt="完整需求", prompt_file=None,
                                  folder=str(self.repo), space="space-test", base=None,
                                  here=False, worktree=False, after=None, branch=None,
                                  start_notes=None, finish_notes=None, **extra)

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

    def record(self, value=None):
        return {"version": 1, "at": 1, "model": self.pick,
                "request_hash": decision.fingerprint(self.loc, "增加功能", "完整需求"),
                "result": value or result()}

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
            Path(argv[argv.index("--output-last-message") + 1]).write_text(json.dumps(result()))
            return SimpleNamespace(returncode=0, stdout="", stderr="")
        with patch.object(decision, "git", return_value=(True, "main", "")), \
             patch.object(decision.subprocess, "run", side_effect=run):
            record = decision.classify(self.loc, "增加功能", "完整需求")
        self.assertEqual(record["model"]["model"], "custom/my-choice")
        self.assertEqual(record["result"]["verification"], ["验证新旧行为"])

    def test_claude_model_has_no_tools_or_hooks(self):
        cmd = decision.model_command({**self.pick, "agent": "claude"}, "/tmp/test")
        self.assertEqual(cmd[cmd.index("--tools") + 1], "")
        self.assertIn("--strict-mcp-config", cmd)
        self.assertEqual(json.loads(cmd[cmd.index("--settings") + 1]),
                         {"disableAllHooks": True, "fastMode": False})
        self.assertEqual(cmd[cmd.index("--model") + 1], self.pick["model"])

    def test_malformed_or_inconsistent_classifications_are_refused(self):
        for value in ({}, result(workflow="hotfix"), result(workflow="none"),
                      result(execution="release"), result(needs_clarification=True),
                      result(requires_review="yes"), result(risk=[])):
            with self.subTest(value=value), self.assertRaises(Fail):
                decision.validate(value)

    def test_failure_never_creates_task_or_falls_back(self):
        with patch.object(decision, "locate", return_value=self.loc), \
             patch.object(decision, "git", return_value=(True, "main", "")), \
             patch.object(decision.subprocess, "run", return_value=SimpleNamespace(returncode=1, stderr="unavailable")):
            with self.assertRaisesRegex(Fail, "No task was created"):
                decision.prepare(self.args(), "完整需求")
        self.assertFalse(self.created)

    def test_readonly_release_and_ambiguous_requests_do_not_create_code_tasks(self):
        for value in (result(workflow="none", execution="investigate", task_type="research"),
                      result(workflow="release", execution="release", task_type="release"),
                      result(needs_clarification=True, execution="clarify", questions=["是生产 bug 吗？"])):
            with patch.object(decision, "classify", return_value=self.record(value)), self.assertRaises(Fail):
                decision.prepare(self.args(), "完整需求")
        self.assertFalse(self.created)

    def test_classification_happens_before_lock_and_selects_dev(self):
        task = self.add(self.record())
        self.assertEqual(task["base"], "dev")
        self.assertEqual(task["workflow"], "development")
        self.assertEqual(task["decision"]["result"]["reason"], result()["reason"])
        self.assertEqual(task["set"]["review"], "on")

    def test_production_bug_selects_main_without_changing_checked_out_branch(self):
        self.git("switch", "-q", "dev")
        hotfix = result(task_type="hotfix", workflow="hotfix", production_bug=True)
        task = self.add(self.record(hotfix))
        self.assertEqual(task["base"], "main")
        self.assertEqual(self.git("branch", "--show-current"), "dev")
        commands.require_task_base(task)
        with self.assertRaises(Fail):
            commands.require_base("dev", task)

    def test_explicit_override_keeps_original_recommendation(self):
        task = self.add(self.record(), workflow="hotfix")
        self.assertEqual(task["base"], "main")
        self.assertEqual(task["decision"]["result"]["workflow"], "development")
        self.assertEqual(task["decision_override"]["workflow"], "hotfix")

    def test_cached_decision_reuse_is_bound_to_request_and_folder(self):
        path = self.root / "decision.json"
        path.write_text(json.dumps(self.record()))
        with patch.object(decision, "classify", side_effect=AssertionError("must not call model twice")):
            record = decision.prepare(self.args(decision_file=str(path)), "完整需求")
            self.assertEqual(record["result"], result())
            with self.assertRaisesRegex(Fail, "different request"):
                decision.prepare(self.args(decision_file=str(path)), "changed")

    def test_typesafe_calls_selected_agent_provider_and_preserves_choice(self):
        for agent in ("codex", "claude"):
            pick = {"agent": agent, "model": "typesafe/jev-latest"}
            Path(settings.SETTINGS).write_text(json.dumps({"everywhere": {"decider": pick}}))
            choices = {"task_type": "hotfix", "risk": "high", "complexity": "medium",
                       "requires_review": "yes", "requires_proof": "yes"}
            def request(chosen, endpoint, body):
                self.assertEqual(chosen, agent)
                self.assertEqual(endpoint, "systemone")
                self.assertEqual(body["model"], pick["model"])
                self.assertIn("request", body["state"])
                return {"answers": {k: {"choice": v} for k, v in choices.items()}}
            with patch.object(decision_provider, "request", side_effect=request), \
                 patch.object(decision, "git", return_value=(True, "dev", "")), \
                 patch.object(decision.subprocess, "run", side_effect=AssertionError("must not launch a coding CLI")):
                record = decision.classify(self.loc, "修复线上登录bug")
            self.assertEqual(record["model"]["agent"], agent)
            self.assertEqual(record["result"]["workflow"], "hotfix")
            self.assertTrue(record["result"]["requires_review"])

    def test_typesafe_discovery_keeps_only_native_typesafe_decision_models(self):
        rows = [{"id": "typesafe/jev-latest", "kind": "decision"},
                {"id": "typesafe/jev-preview", "kind": "decision"},
                {"id": "typesafe/jev-router", "kind": "chat"},
                {"id": "other/decision", "kind": "decision"}]
        with patch.object(decision_provider, "request", return_value={"data": rows}):
            self.assertEqual([m["id"] for m in decision_provider.models()],
                             ["typesafe/jev-latest", "typesafe/jev-preview"])

    def test_typesafe_readonly_release_clarification_and_malformed_answers(self):
        pick = {"agent": "codex", "model": "typesafe/jev-preview"}
        for kind, execution, workflow in (("research", "investigate", "none"), ("release", "release", "release"),
                                          ("clarify", "clarify", "none"), ("configuration", "implement", "development")):
            choices = {"task_type": kind, "risk": "medium", "complexity": "low",
                       "requires_review": "no", "requires_proof": "yes"}
            with patch.object(decision_provider, "request", return_value={"answers": {k: {"choice": v} for k, v in choices.items()}}):
                value = decision.validate(decision_provider.classification(pick, {}, "rules"))
            self.assertEqual((value["execution"], value["workflow"]), (execution, workflow))
        with patch.object(decision_provider, "request", return_value={"answers": {}}), self.assertRaises(Fail):
            decision_provider.classification(pick, {}, "rules")


# Avoid rerunning the fixture's inherited tests in this module.
for name in dir(fixture.GitWorkflowTests):
    if name.startswith("test_") and name not in DecisionTests.__dict__:
        setattr(DecisionTests, name, None)


if __name__ == "__main__":
    unittest.main()
