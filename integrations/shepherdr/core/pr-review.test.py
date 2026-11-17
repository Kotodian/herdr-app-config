"""Human approval and exact PR diffs, exercised against real throwaway worktrees."""
import argparse
import importlib.util
import json
import os
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("workflow_fixture", Path(__file__).with_name("git-workflow.test.py"))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
from herdr_task import commands, human_review as review
from herdr_task.base import Fail


class HumanReviewTests(unittest.TestCase):
    setUp = fixture.GitWorkflowTests.setUp
    git = fixture.GitWorkflowTests.git
    worktree = fixture.GitWorkflowTests.worktree

    def prepare(self):
        value = json.loads(self.policy_path.read_text())
        value["human_review_required"] = True
        self.policy_path.write_text(json.dumps(value))
        wt = self.worktree()
        (wt / "文件 with spaces.txt").write_text("before\n")
        self.git("add", ".", cwd=wt)
        self.git("commit", "-qm", "feature", cwd=wt)
        task = {"id": 1, "state": "ready", "mode": "worktree", "branch": "task/1",
                "base": "dev", "start": self.baseline, "worktree": str(wt), "agents": []}
        self.store.find = lambda _: task
        self.store.key = lambda _: "test"
        return task, wt

    def approval(self, task):
        with patch.dict(os.environ, {}, clear=True):
            return review.approve(self.store, task, review.review_diff(self.store, task)["snapshot"])

    def test_committed_diff_contains_branch_work_and_preserves_unicode_paths(self):
        task, wt = self.prepare()
        out = review.review_diff(self.store, task, "文件 with spaces.txt")
        self.assertIn("+before", out["patch"]["text"])
        self.assertEqual(out["file_count"], 1)
        self.assertFalse(out["approved"])
        self.assertEqual(out["head"], self.git("rev-parse", "HEAD", cwd=wt))

    def test_uncommitted_and_untracked_edits_are_separate_from_pr_commits(self):
        task, wt = self.prepare()
        (wt / "文件 with spaces.txt").write_text("working edit\n")
        (wt / "new file.txt").write_text("new\n")
        committed = review.review_diff(self.store, task, "文件 with spaces.txt")
        working = review.review_diff(self.store, task, "文件 with spaces.txt", working=True)
        self.assertIn("+before", committed["patch"]["text"])
        self.assertNotIn("working edit", committed["patch"]["text"])
        self.assertIn("+working edit", working["patch"]["text"])
        self.assertEqual(working["file_count"], 2)
        with patch.dict(os.environ, {}, clear=True), self.assertRaisesRegex(Fail, "uncommitted"):
            review.approve(self.store, task, committed["snapshot"])

    def test_every_herdr_merge_entry_refuses_before_human_approval(self):
        task, _ = self.prepare()

        @contextmanager
        def opened(*args, **kwargs):
            yield self.store

        with patch.object(commands, "open_store", opened), \
             patch.object(commands, "live_agents", return_value=[]):
            for action in (lambda: commands.ff_merge(self.store, task),
                           lambda: commands.cmd_merge(argparse.Namespace(id=1)),
                           lambda: commands.cmd_accept(argparse.Namespace(id=1))):
                with self.subTest(action=action), self.assertRaisesRegex(Fail, "Human review required"):
                    action()
        self.assertEqual(self.git("rev-parse", "dev"), self.baseline)

    def test_human_approval_enables_only_the_exact_reviewed_fast_forward(self):
        task, wt = self.prepare()
        approved = self.approval(task)
        self.assertTrue(approved["approved"])
        self.assertTrue(commands.ff_merge(self.store, task))
        self.assertEqual(self.git("rev-parse", "dev"), approved["head"])
        self.assertEqual(self.git("rev-parse", "main"), self.baseline)

    def test_new_commit_invalidates_an_existing_approval(self):
        task, wt = self.prepare()
        self.approval(task)
        self.git("commit", "-q", "--allow-empty", "-m", "another change", cwd=wt)
        self.assertFalse(review.review_diff(self.store, task)["approved"])
        with self.assertRaisesRegex(Fail, "Human review required"):
            commands.ff_merge(self.store, task)

    def test_dirty_worktree_blocks_an_existing_approval(self):
        task, wt = self.prepare()
        self.approval(task)
        (wt / "文件 with spaces.txt").write_text("unreviewed work\n")
        with self.assertRaisesRegex(Fail, "Human review required"):
            commands.ff_merge(self.store, task)
        self.assertEqual(self.git("rev-parse", "dev"), self.baseline)

    def test_github_merge_is_refused_before_a_merge_call(self):
        task, wt = self.prepare()
        task["pr"] = {"number": 12, "repo": "example/repo"}
        remote = {"state": "OPEN", "baseRefName": "dev", "baseRefOid": self.baseline,
                  "headRefOid": self.git("rev-parse", "HEAD", cwd=wt)}
        with patch.object(commands, "pr_view", return_value=remote), \
             patch.object(commands, "note_checks"), \
             patch.object(commands, "gh", side_effect=AssertionError("must not merge")):
            with self.assertRaisesRegex(Fail, "Human review required"):
                commands.merge_now(self.store, task)

    def test_multiple_line_and_pr_comments_are_sent_together_for_fixes(self):
        task, _ = self.prepare()
        token = self.approval(task)["snapshot"]
        with patch.dict(os.environ, {}, clear=True):
            review.comment(self.store, task, token, "处理错误返回", "文件 with spaces.txt", 1, "RIGHT")
            review.comment(self.store, task, token, "补上测试")
            with patch.object(commands, "tell", return_value=("t-test", False)) as tell:
                out = review.request_changes(self.store, task, token, argparse.Namespace())
        self.assertEqual(out["state"], "running")
        self.assertFalse(out["approved"])
        self.assertNotIn("human_review", task)
        self.assertEqual([c["status"] for c in task["human_comments"]], ["changes", "changes"])
        message = tell.call_args.args[2]
        self.assertIn("处理错误返回", message)
        self.assertIn("补上测试", message)
        self.assertIn("文件 with spaces.txt:1 (new side)", message)
        for c in task["human_comments"]:
            self.assertIn(c["id"], message)
        self.assertEqual(self.git("rev-parse", "dev"), self.baseline)

    def test_stale_comments_cannot_be_submitted_against_a_new_commit(self):
        task, wt = self.prepare()
        token = review.review_diff(self.store, task)["snapshot"]
        with patch.dict(os.environ, {}, clear=True):
            review.comment(self.store, task, token, "fix this")
            self.git("commit", "-q", "--allow-empty", "-m", "changed", cwd=wt)
            with patch.object(commands, "tell", side_effect=AssertionError("no worker wake")), \
                 self.assertRaisesRegex(Fail, "local commit or base changed"):
                review.request_changes(self.store, task, token, argparse.Namespace())
        self.assertEqual(task["state"], "ready")

    def test_invalid_line_is_refused_and_only_drafts_can_be_deleted(self):
        task, _ = self.prepare()
        token = review.review_diff(self.store, task)["snapshot"]
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(Fail, "not in"):
                review.comment(self.store, task, token, "x", "文件 with spaces.txt", 200, "RIGHT")
            review.comment(self.store, task, token, "draft")
            review.comment(self.store, task, token, remove=task["human_comments"][0]["id"])
        self.assertEqual(task["human_comments"], [])

    def test_worker_delivery_failure_preserves_drafts_and_revokes_approval(self):
        task, _ = self.prepare()
        token = self.approval(task)["snapshot"]
        with patch.dict(os.environ, {}, clear=True):
            review.comment(self.store, task, token, "fix")
            with patch.object(commands, "tell", side_effect=Fail("worker offline")), \
                 self.assertRaisesRegex(Fail, "worker offline"):
                review.request_changes(self.store, task, token, argparse.Namespace())
        self.assertNotIn("human_review", task)
        self.assertEqual(task["state"], "ready")
        self.assertEqual(task["human_comments"][0]["status"], "draft")

    def test_recorded_pr_reads_comments_and_approval_use_only_local_commits(self):
        task, _ = self.prepare()
        task["pr"] = {"repo": "example/repo", "number": 12, "url": "https://github.com/example/repo/pull/12"}
        from herdr_task import github
        with patch.object(github, "pr_view", side_effect=AssertionError("no GitHub reads")), \
             patch.object(github, "gh", side_effect=AssertionError("no GitHub command")), \
             patch.object(commands, "pr_view", side_effect=AssertionError("no GitHub reads")), \
             patch.dict(os.environ, {}, clear=True):
            out = review.review_diff(self.store, task, "文件 with spaces.txt")
            self.assertIn("+before", out["patch"]["text"])
            review.comment(self.store, task, out["snapshot"], "本地行评论", "文件 with spaces.txt", 1, "RIGHT")
            approved = review.approve(self.store, task, out["snapshot"])
        self.assertTrue(approved["approved"])
        self.assertEqual(approved["comments"][0]["body"], "本地行评论")
        self.assertEqual(out["pr_url"], task["pr"]["url"])

    def test_changed_base_invalidates_approval_and_an_open_diff_snapshot(self):
        task, _ = self.prepare()
        first = self.approval(task)
        self.git("commit", "-q", "--allow-empty", "-m", "base changed")
        self.git("branch", "-f", "dev", "main")
        with patch.dict(os.environ, {}, clear=True), self.assertRaisesRegex(Fail, "base changed"):
            review.approve(self.store, task, first["snapshot"])
        with self.assertRaisesRegex(Fail, "Human review required"):
            commands.ff_merge(self.store, task)

    def test_agent_cannot_record_the_persons_approval(self):
        task, _ = self.prepare()
        token = review.review_diff(self.store, task)["snapshot"]
        with patch.dict(os.environ, {"CODEX_THREAD_ID": "agent-session"}):
            with self.assertRaisesRegex(Fail, "agents cannot approve"):
                review.approve(self.store, task, token)
        self.assertNotIn("human_review", task)

    def test_a_path_outside_the_changed_file_list_is_refused(self):
        task, _ = self.prepare()
        for path in ("../private", "/etc/passwd", "unchanged.txt"):
            with self.subTest(path=path), self.assertRaisesRegex(Fail, "not among"):
                review.review_diff(self.store, task, path)

    def test_changed_remote_head_cannot_reuse_local_approval(self):
        task, wt = self.prepare()
        approved = self.approval(task)
        self.git("commit", "-q", "--allow-empty", "-m", "new remote head", cwd=wt)
        task["pr"] = {"number": 12, "repo": "example/repo"}
        remote = {"baseRefName": "dev", "baseRefOid": self.baseline,
                  "headRefOid": self.git("rev-parse", "HEAD", cwd=wt)}
        with self.assertRaisesRegex(Fail, "Human review required"):
            review.require_approval(self.store, task, remote)
        self.assertEqual(task["human_review"]["head"], approved["head"])

    def test_pr_stage_overrides_automatic_review_even_with_an_old_review_brief(self):
        task, _ = self.prepare()
        from herdr_task import settings
        value = json.loads(self.policy_path.read_text())
        value["pr_review_manual"] = True
        self.policy_path.write_text(json.dumps(value))
        task.update(pr={"number": 12}, brief_review={"on": True, "rounds": 1},
                    review_gate=True, agents=[{"argv": ["codex"]}])
        cfg = {"tasks": {"review_rounds": 1}, "worker": {}, "agents": {}}
        with patch.object(settings, "settings_for", return_value=cfg), \
             patch.object(settings, "by_layer", return_value=None):
            rows = {row["label"]: row for row in settings.task_settings(self.store, task)}
            self.assertFalse(rows["Review"]["value"])
            self.assertEqual(rows["Review"]["by"], "workflow")
            self.assertNotIn("Reviewer", rows)
            self.assertIsNone(commands.review_refusal(self.store, task, task["worktree"]))
        self.assertTrue(task["brief_review"]["on"])

    def test_submitted_human_comments_publish_to_pr_once_and_keep_original_text(self):
        task, _ = self.prepare()
        from herdr_task import github
        task["pr"] = {"repo": "example/repo", "number": 12}
        comment = {"id": "human1", "by": "person", "status": "changes", "head": "a" * 40,
                   "path": "src/中文.go", "line": 37, "side": "RIGHT", "body": "为什么这里要判断？"}
        task["human_comments"] = [comment]
        response = {"id": 98, "html_url": "https://github.com/example/repo/pull/12#issuecomment-98"}
        with patch.object(review, "policy", return_value={"publish_review_comments": True}), \
             patch.object(github, "gh", side_effect=[(True, "", ""), (True, json.dumps(response), "")]) as gh:
            review.sync_comments(self.store, task)
            review.sync_comments(self.store, task)
        self.assertEqual(gh.call_count, 2)
        body = gh.call_args.args[-1]
        self.assertIn(comment["body"], body)
        self.assertIn("herdr-human-comment:", body)
        self.assertEqual(comment["pr_comment"]["id"], 98)
        self.assertEqual(comment["status"], "changes")

    def test_comment_sync_recovers_a_posted_comment_without_posting_duplicates(self):
        task, _ = self.prepare()
        from herdr_task import github
        task["pr"] = {"repo": "example/repo", "number": 12}
        comment = {"id": "h1", "by": "person", "status": "changes", "body": "keep"}
        task["human_comments"] = [comment]
        existing = {"id": 98, "html_url": "https://github.com/example/repo/pull/12#issuecomment-98",
                    "body": f"keep\n<!-- herdr-human-comment:{self.store.ref(task)}:h1 -->"}
        with patch.object(review, "policy", return_value={"publish_review_comments": True}), \
             patch.object(github, "gh", return_value=(True, json.dumps(existing), "")) as gh:
            review.sync_comments(self.store, task)
        self.assertEqual(gh.call_count, 1)
        self.assertEqual(comment["pr_comment"]["id"], 98)

    def test_comment_sync_failure_preserves_feedback_for_retry_and_never_posts_drafts(self):
        task, _ = self.prepare()
        from herdr_task import github
        task["pr"] = {"repo": "example/repo", "number": 12}
        submitted = {"id": "h1", "by": "person", "status": "changes", "body": "keep"}
        draft = {"id": "h2", "by": "person", "status": "draft", "body": "not submitted"}
        task["human_comments"] = [submitted, draft]
        with patch.object(review, "policy", return_value={"publish_review_comments": True}), \
             patch.object(github, "gh", return_value=(False, "", "offline")) as gh:
            review.sync_comments(self.store, task)
        self.assertEqual(gh.call_count, 1)
        self.assertEqual(submitted["pr_sync_error"], "offline")
        self.assertNotIn("pr_sync_error", draft)
        self.assertEqual(submitted["body"], "keep")


if __name__ == "__main__":
    unittest.main()
