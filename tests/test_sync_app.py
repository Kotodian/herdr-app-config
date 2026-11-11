import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location("sync_app", Path(__file__).resolve().parents[1] / "sync-app.py")
sync = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sync)


class PublishedBaselineTests(unittest.TestCase):
    def test_divergent_git_histories_merge_json_and_keep_both_commits(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory).resolve()
            origin=root/"origin.git";repo=root/"repo";other=root/"other";app=root/"app"
            app.mkdir()
            for name in ("mods","layouts","themes"):(app/name).mkdir()
            def git(*args,cwd=root):
                result=subprocess.run(["git",*args],cwd=cwd,capture_output=True,text=True)
                self.assertEqual(result.returncode,0,result.stderr)
                return result.stdout.strip()
            git("init","--bare","-q",str(origin))
            git("init","-q","-b","main",str(repo))
            for key,value in (("user.name","Sync test"),("user.email","sync@example.invalid"),("commit.gpgsign","false")):
                git("config",key,value,cwd=repo)
            git("remote","add","origin",str(origin),cwd=repo)
            original={"settings.json":b'{"font":14,"theme":"dark"}'}
            local={"settings.json":b'{"font":16,"theme":"dark"}'}
            remote={"settings.json":b'{"font":14,"theme":"light"}'}
            with patch.object(sync,"ROOT",repo),patch.object(sync,"STATE",root/"state.json"):
                sync.snapshot(original,[])
                git("add",".",cwd=repo);git("commit","-qm","base",cwd=repo)
                git("push","-qu","origin","main",cwd=repo)
                git("clone","-q","-b","main",str(origin),str(other))
                for key,value in (("user.name","Sync test"),("user.email","sync@example.invalid"),("commit.gpgsign","false")):
                    git("config",key,value,cwd=other)
                sync.save_state(original)
                sync.snapshot(local,[])
                git("add",".",cwd=repo);git("commit","-qm","local font change",cwd=repo)
                with patch.object(sync,"ROOT",other):sync.snapshot(remote,[])
                git("add",".",cwd=other);git("commit","-qm","remote theme change",cwd=other)
                git("push","-q","origin","main",cwd=other)
                (app/"settings.json").write_bytes(local["settings.json"])
                sync.auto_sync(app)
                self.assertEqual(json.loads((app/"settings.json").read_text()),{"font":16,"theme":"light"})
                self.assertEqual(len(git("rev-list","--parents","-n","1","HEAD",cwd=repo).split()),3)
                self.assertEqual(git("rev-parse","HEAD",cwd=repo),git("rev-parse","origin/main",cwd=repo))
                status=json.loads((root/"native-status.json").read_text())
                self.assertEqual(status["status"],"ok")
                self.assertEqual(status["auto_merged"],["settings.json"])

    def merge_with_base(self,name,base,left,right):
        encode=lambda value:json.dumps(value).encode()
        data={name:encode(base)}
        with patch.object(sync,"load_base",return_value=data[name]):
            return json.loads(sync.merge_files(sync.hashes(data),{name:encode(left)},{name:encode(right)})[name])

    def test_json_independent_fields_merge(self):
        result=self.merge_with_base("settings.json",{"font":14,"theme":"dark"},
                                   {"font":16,"theme":"dark"},{"font":14,"theme":"light"})
        self.assertEqual(result,{"font":16,"theme":"light"})

    def test_nested_json_additions_merge(self):
        result=self.merge_with_base("keys.json",{"global":{}},
                                   {"global":{"cmd-a":"first"}},{"global":{"cmd-b":"second"}})
        self.assertEqual(result["global"],{"cmd-a":"first","cmd-b":"second"})

    def test_same_field_changed_differently_is_retained_for_review(self):
        with self.assertRaises(sync.ConfigurationConflict):
            self.merge_with_base("settings.json",{"font":14},{"font":16},{"font":18})

    def test_layout_node_additions_merge(self):
        node=lambda id:{"id":id,"type":"block"}
        result=self.merge_with_base("layouts/custom.json",{"children":[node("space")]},
                                   {"children":[node("space"),node("projects")]},
                                   {"children":[node("space"),node("map")]})
        self.assertEqual({n["id"] for n in result["children"]},{"space","projects","map"})

    def test_conflicting_reorders_require_review(self):
        node=lambda id:{"id":id}
        with self.assertRaises(sync.ConfigurationConflict):
            self.merge_with_base("layouts/custom.json",list(map(node,"abc")),
                                 list(map(node,"bac")),list(map(node,"acb")))

    def test_kanso_keeps_live_terminal_and_merges_preferences(self):
        def layout(terminal,font=14,theme="dark"):
            return {"id":"root","font_size":font,"theme":theme,"children":[
                {"id":"work-body","type":"row","children":[
                    {"id":"strip-"+terminal,"content":{"terminal":terminal}},
                    {"id":"panel-body","children":[{"id":terminal+"-panel"}],"size":{"px":340}}
                ]}]}
        result=self.merge_with_base("layouts/kanso.json",layout("old"),layout("local",font=16),layout("remote",theme="light"))
        self.assertEqual(result["font_size"],16)
        self.assertEqual(result["theme"],"light")
        self.assertEqual(result["children"][0]["children"][0]["content"]["terminal"],"local")
        self.assertEqual(result["children"][0]["children"][1]["children"][0]["id"],"local-panel")

    def test_nonoverlapping_code_changes_merge(self):
        base=b"one\ntwo\nthree\nfour\nfive\n"
        left=base.replace(b"one",b"ONE")
        right=base.replace(b"five",b"FIVE")
        result,reason=sync.merge_content("mods/example/main.js",base,left,right)
        self.assertIsNone(reason)
        self.assertEqual(result,b"ONE\ntwo\nthree\nfour\nFIVE\n")

    def test_deletions_still_require_review(self):
        with patch.object(sync,"load_base",return_value=b"old"):
            with self.assertRaises(sync.ConfigurationConflict):
                sync.merge_files(sync.hashes({"settings.json":b"old"}),{},{"settings.json":b"old"})

    def test_merged_settings_apply_only_against_the_checked_local_version(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory).resolve()
            app=root/"app";app.mkdir()
            repo=root/"repo";repo.mkdir()
            original={"settings.json":b'{"font":14,"theme":"dark"}'}
            local={"settings.json":b'{"font":16,"theme":"dark"}'}
            merged={"settings.json":b'{"font":16,"theme":"light"}'}
            (app/"settings.json").write_bytes(local["settings.json"])
            with patch.object(sync,"STATE",root/"state.json"),patch.object(sync,"ROOT",repo):
                sync.save_state(original)
                sync.snapshot(merged,[])
                sync.apply(app,execute=True,expected_local=sync.hashes(local))
                self.assertEqual(json.loads((app/"settings.json").read_text()),{"font":16,"theme":"light"})

    def test_a_new_edit_after_merge_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory).resolve()
            app=root/"app";app.mkdir()
            repo=root/"repo";repo.mkdir()
            original={"settings.json":b'{"font":14}'}
            checked={"settings.json":b'{"font":16}'}
            fresh=b'{"font":20}'
            (app/"settings.json").write_bytes(fresh)
            with patch.object(sync,"STATE",root/"state.json"),patch.object(sync,"ROOT",repo):
                sync.save_state(original)
                sync.snapshot({"settings.json":b'{"font":18}'},[])
                with self.assertRaisesRegex(RuntimeError,"Local configuration differs"):
                    sync.apply(app,execute=True,expected_local=sync.hashes(checked))
                self.assertEqual((app/"settings.json").read_bytes(),fresh)

    def test_coordinator_export_includes_program_and_skill_only(self):
        root = sync.COORDINATOR
        for name in ("src/cli.ts", "plugin/skills/coordinator/SKILL.md",
                     "plugin/.claude-plugin/plugin.json", "package.json", "bun.lock"):
            self.assertTrue(sync.coordinator_source(root / name), name)
        for name in ("node_modules/tool/index.ts", "src/.env.json", "data/config.json",
                     "plugin/.credentials.json", "tests/agents.test.ts"):
            self.assertFalse(sync.coordinator_source(root / name), name)

    def test_acknowledges_outgoing_edits_but_keeps_incoming_baseline(self):
        baseline = sync.hashes({"layout": b"old", "settings": b"old"})
        local = {"layout": b"uploaded", "settings": b"old"}
        published = {"layout": b"uploaded", "settings": b"incoming"}
        actual = sync.published_baseline(baseline, local, published)
        self.assertEqual(actual, sync.hashes({"layout": b"uploaded", "settings": b"old"}))

    def test_preserves_three_way_conflicts(self):
        baseline = sync.hashes({"layout": b"old"})
        with self.assertRaisesRegex(RuntimeError, "Configuration conflict"):
            sync.merge_files(baseline, {"layout": b"local"}, {"layout": b"remote"})

    def test_upload_during_live_edit_is_pending_and_can_sync_again(self):
        original = {"layouts/kanso.json": b'{"generation":1}'}
        uploaded = {"layouts/kanso.json": b'{"generation":2}'}
        newer = {"layouts/kanso.json": b'{"generation":3}'}
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            with patch.object(sync, "STATE", state):
                sync.save_state(original)
                def git(*args):
                    if args[:2] == ("branch", "--show-current"):
                        return "main"
                    if args[0] == "rev-list":
                        return "0 0"
                    if args[0] == "rev-parse":
                        return "published-commit"
                    return ""
                with patch.object(sync, "git", side_effect=git), \
                     patch.object(sync, "validate", return_value=({}, original)), \
                     patch.object(sync, "collect", side_effect=[(uploaded, []), (uploaded, []), (newer, [])]), \
                     patch.object(sync, "validate_changes"), \
                     patch.object(sync, "snapshot"), \
                     patch.object(sync, "record_status") as status, \
                     patch.object(sync, "apply") as apply:
                    sync.auto_sync(Path(directory))
                    self.assertEqual(json.loads(state.read_text())["files"], sync.hashes(uploaded))
                    self.assertEqual(status.call_args.args, ("pending",))
                    apply.assert_not_called()
                # The next run sees a local-only edit, rather than a false double edit.
                result = sync.merge_files(json.loads(state.read_text())["files"], newer, uploaded)
                self.assertEqual(result, newer)

    def test_failed_push_does_not_advance_baseline(self):
        original = {"layouts/kanso.json": b"old"}
        uploaded = {"layouts/kanso.json": b"new"}
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            with patch.object(sync, "STATE", state):
                sync.save_state(original)
                def git(*args):
                    if args[:2] == ("branch", "--show-current"):
                        return "main"
                    if args[0] == "rev-list":
                        return "0 0"
                    if args[0] == "push":
                        raise RuntimeError("network unavailable")
                    return ""
                with patch.object(sync, "git", side_effect=git), \
                     patch.object(sync, "validate", return_value=({}, original)), \
                     patch.object(sync, "collect", return_value=(uploaded, [])), \
                     patch.object(sync, "validate_changes"), \
                     patch.object(sync, "snapshot"), \
                     patch.object(sync, "record_status"):
                    with self.assertRaisesRegex(RuntimeError, "network unavailable"):
                        sync.auto_sync(Path(directory))
                self.assertEqual(json.loads(state.read_text())["files"], sync.hashes(original))


if __name__ == "__main__":
    unittest.main()
