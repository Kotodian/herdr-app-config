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


class MainCheckoutMigrationTests(unittest.TestCase):
    def git(self, *args, cwd):
        result = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip()

    def prepare(self, root, merged):
        origin = root / "origin.git"
        repo = root / "repo"
        app = root / "app"
        for name in ("mods", "layouts", "themes"):
            (app / name).mkdir(parents=True)
        self.git("init", "--bare", "-q", str(origin), cwd=root)
        self.git("init", "-q", "-b", "main", str(repo), cwd=root)
        for key, value in (("user.name", "Sync test"), ("user.email", "sync@example.invalid"),
                           ("commit.gpgsign", "false")):
            self.git("config", key, value, cwd=repo)
        self.git("remote", "add", "origin", str(origin), cwd=repo)
        original = {"settings.json": b'{"font_size":14}\n'}
        updated = {"settings.json": b'{"font_size":16}\n'}
        with patch.object(sync, "ROOT", repo), patch.object(sync, "STATE", root / "state.json"):
            sync.snapshot(original, [])
            sync.save_state(original)
            self.git("add", ".", cwd=repo)
            self.git("commit", "-qm", "original main", cwd=repo)
            self.git("push", "-q", "origin", "main", cwd=repo)
            self.git("switch", "-qc", "dev", cwd=repo)
            sync.snapshot(updated, [])
            self.git("add", ".", cwd=repo)
            self.git("commit", "-qm", "configuration on dev", cwd=repo)
            self.git("push", "-q", "origin", "dev", cwd=repo)
            if merged:
                self.git("push", "-q", "origin", "dev:main", ":dev", cwd=repo)
        (app / "settings.json").write_bytes(updated["settings.json"])
        expected = "https://github.com/" + sync.REPO + ".git"
        self.git("remote", "set-url", "origin", expected, cwd=repo)
        self.git("config", "url." + str(origin) + ".insteadOf", expected, cwd=repo)
        return repo, app

    def test_old_dev_checkout_switches_and_syncs_without_recreating_dev(self):
        for main_exists in (True, False):
            with self.subTest(main_exists=main_exists), tempfile.TemporaryDirectory() as directory:
                root = Path(directory).resolve()
                repo, app = self.prepare(root, merged=True)
                previous_dev = self.git("rev-parse", "dev", cwd=repo)
                if not main_exists:
                    self.git("branch", "-D", "main", cwd=repo)
                with patch.object(sync, "ROOT", repo), patch.object(sync, "STATE", root / "state.json"):
                    sync.ensure_repo(app)
                    sync.auto_sync(app)
                self.assertEqual(self.git("branch", "--show-current", cwd=repo), "main")
                self.assertEqual(self.git("rev-parse", "HEAD", cwd=repo), previous_dev)
                self.assertEqual(self.git("ls-remote", "origin", "refs/heads/dev", cwd=repo), "")
                self.assertEqual(json.loads((root / "native-status.json").read_text())["status"], "ok")

    def test_unmerged_dev_commits_stop_migration_without_switching(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            repo, app = self.prepare(root, merged=False)
            previous_dev = self.git("rev-parse", "dev", cwd=repo)
            with patch.object(sync, "ROOT", repo):
                with self.assertRaisesRegex(RuntimeError, "commits not yet merged"):
                    sync.ensure_repo(app)
            self.assertEqual(self.git("branch", "--show-current", cwd=repo), "dev")
            self.assertEqual(self.git("rev-parse", "HEAD", cwd=repo), previous_dev)

    def test_uncommitted_edits_stop_migration_without_changing_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            repo, app = self.prepare(root, merged=True)
            settings = repo / "settings.json"
            pending = b'{"font_size":20}\n'
            settings.write_bytes(pending)
            with patch.object(sync, "ROOT", repo):
                with self.assertRaisesRegex(RuntimeError, "clean configuration checkout"):
                    sync.ensure_repo(app)
            self.assertEqual(self.git("branch", "--show-current", cwd=repo), "dev")
            self.assertEqual(settings.read_bytes(), pending)


class PublishedBaselineTests(unittest.TestCase):
    def test_configuration_sync_uses_main_and_refuses_dev_without_pushing(self):
        self.assertEqual(sync.SYNC_BRANCH, "main")
        with tempfile.TemporaryDirectory() as directory, \
             patch.object(sync, "STATE", Path(directory) / "state.json"), \
             patch.object(sync, "validate", return_value=({}, {})), \
             patch.object(sync, "save_state"), \
             patch.object(sync, "record_status"), \
             patch.object(sync, "git", return_value="dev") as git:
            with self.assertRaisesRegex(RuntimeError, "Expected main branch"):
                sync.auto_sync(Path(directory))
            self.assertEqual(git.call_args_list, [unittest.mock.call("branch", "--show-current")])

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
                        return sync.SYNC_BRANCH
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
                        return sync.SYNC_BRANCH
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


class ShepherdrSyncTests(unittest.TestCase):
    def make_app(self, root):
        app=root/"app"
        for name in ("mods","layouts","themes"):
            (app/name).mkdir(parents=True)
        source=app.joinpath(*sync.SHEPHERDR.parts)
        (source/"bin").mkdir(parents=True)
        (source/"bin/shepherdr").write_text("#!/usr/bin/env python3\n")
        (source/"lib").mkdir()
        (source/"lib/addons.json").write_text('{"core":{"mods":["chat"]},"addons":[]}')
        return app,source

    def test_workflow_policy_survives_snapshot_validation(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory).resolve()
            app,_=self.make_app(root)
            policy=b'{"version":1,"development_branch":"dev","production_branch":"main"}\n'
            (app/"git-workflow.json").write_bytes(policy)
            files,mods=sync.collect(app)
            self.assertEqual(files["git-workflow.json"],policy)
            with patch.object(sync,"ROOT",root/"checkout"):
                sync.snapshot(files,mods)
                _,restored=sync.validate()
            self.assertEqual(restored["git-workflow.json"],policy)

    def test_release_round_trip_keeps_helpers_and_assets_but_omits_runtime(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory).resolve()
            app,source=self.make_app(root)
            payload={
                "keys.json":'{"layout:shepherdr":{}}',
                "mods/tasks/bin/herdr-task":"#!/usr/bin/env python3\n",
                "mods/chat/audio.swift":"import Foundation\n",
                "web/src/App.tsx":"export default function App() { return null; }\n",
                "web/dist/index.html":"<html></html>",
                "web/dist/manifest.webmanifest":'{"name":"Shepherdr"}',
                "web/dist/assets/app.js":"console.log('ready')",
                "web/dist/assets/font.woff2":"font data",
                "node_modules/package/index.js":"excluded dependency",
                "data/tasks.json":"excluded tasks",
                "web/dist/.env":"excluded credential",
            }
            for name,text in payload.items():
                path=source/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)
            (app/"mods/chat").mkdir()
            (app/"mods/chat/main.js").write_text("// generated installed copy")
            files,mods=sync.collect(app)
            prefix=sync.SHEPHERDR.as_posix()+"/"
            for name in list(payload)[:8]:
                self.assertIn(prefix+name,files,name)
            for name in list(payload)[8:]:
                self.assertNotIn(prefix+name,files,name)
            self.assertIn(prefix+"bin/shepherdr",files)
            self.assertIn(prefix+"lib/addons.json",files)
            self.assertNotIn("chat",mods)
            self.assertNotIn("mods/chat/main.js",files)
            repo=root/"repo";repo.mkdir()
            with patch.object(sync,"ROOT",repo):
                sync.snapshot(files,mods)
                self.assertEqual(sync.validate()[1],files)

    def test_extensionless_helpers_are_portable_on_another_home(self):
        path=sync.SHEPHERDR/"bin/shepherdr"
        self.assertTrue(sync.text_file(path))
        data=("#!"+str(Path.home())+"/.local/bin/python3\n").encode()
        self.assertNotIn(str(Path.home()).encode(),sync.portable(data))

    def test_source_policy_rejects_machine_state_and_hidden_files(self):
        for name in ("data/tasks.json","state/service/token.json","node_modules/p/index.js",
                     "bin/.credentials.json","mods/chat/data/session.json","web/dist/.env","web/.git/config"):
            self.assertFalse(sync.shepherdr_source(sync.SHEPHERDR/name),name)

    def test_local_registration_restores_permissions_and_only_repeats_for_source_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory).resolve()
            app,source=self.make_app(root)
            home=root/"home"
            for name in ("shepherdr","herdr-task","herdr-artifact","herdr-secret","herdr-browser"):
                link=home/".local/bin"/name;link.parent.mkdir(parents=True,exist_ok=True)
                link.symlink_to(source/"bin/shepherdr")
            record=app/"data/shepherdr/installed.json"
            record.parent.mkdir(parents=True);record.write_text("{}")
            state=root/"state/native-state.json"
            result=subprocess.CompletedProcess([],0,stdout="whole\n",stderr="")
            with patch.object(sync,"STATE",state),patch.object(sync.Path,"home",return_value=home), \
                 patch.object(sync.subprocess,"run",return_value=result) as execute:
                sync.shepherdr_runtime(app)
                sync.shepherdr_runtime(app)
                self.assertEqual(execute.call_count,2)
                install=execute.call_args_list[0]
                self.assertEqual(install.args[0][1],str(source/"bin/shepherdr"))
                self.assertIn("--keys",install.args[0])
                self.assertNotIn("--root",install.args[0])
                self.assertNotIn("env",install.kwargs)
                self.assertEqual((source/"bin/shepherdr").stat().st_mode&0o777,0o755)
                (source/"bin/shepherdr").write_text("#!/usr/bin/env python3\n# new release\n")
                sync.shepherdr_runtime(app)
                self.assertEqual(execute.call_count,4)

    def test_failed_local_install_is_retryable(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory).resolve()
            app,_=self.make_app(root)
            state=root/"state/native-state.json"
            result=subprocess.CompletedProcess([],1,stdout="",stderr="missing dependency")
            with patch.object(sync,"STATE",state),patch.object(sync.subprocess,"run",return_value=result):
                with self.assertRaisesRegex(RuntimeError,"missing dependency"):
                    sync.shepherdr_runtime(app)
                self.assertFalse((state.parent/"shepherdr-runtime.json").exists())


class KansoLayoutSwitchTests(unittest.TestCase):
    def test_stale_kanso_tree_cannot_overwrite_a_newly_selected_layout(self):
        script = r"""
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = process.argv[2];
let checked = 0;
for (const name of fs.readdirSync(path.join(root, "mods"))) {
    const file = path.join(root, "mods", name, "layout.js");
    if (!fs.existsSync(file)) continue;
    let source = fs.readFileSync(file, "utf8");
    if (!source.includes("export const isKansoTree")) continue;
    const state = new Map([["layout", "kanso"]]);
    const calls = [];
    const tree = {id: "root", children: [
        {id: "sidebar", size: {px: 240}},
        {id: "strip-map", children: []},
    ]};
    globalThis.__herdr = {
        layout: () => tree,
        run: (...args) => calls.push(args),
        shared: key => state.get(key),
        setShared: (key, value) => state.set(key, value),
        window: () => ({platform: "macos"}),
    };
    source = source.replace(/import \{([^}]+)\} from "herdr";/,
                            "const {$1} = globalThis.__herdr;");
    const mod = await import("data:text/javascript;base64," +
                             Buffer.from(source).toString("base64") + "#" + name);
    assert.equal(mod.isKansoTree(tree), true, name);
    assert.equal(mod.commitLayout({}), true, name);
    assert.equal(calls[0][0], "layout.set", name);
    calls.length = 0;
    state.set("layout", "shepherdr");
    assert.equal(mod.isKansoTree(tree), false, name);
    assert.equal(mod.commitLayout({}), false, name);
    mod.setRail?.(false, 76);
    assert.deepEqual(calls, [], name + " wrote to Shepherdr using the stale Kanso tree");
    checked++;
}
assert.ok(checked >= 13, "Expected every installed Kanso layout helper");
console.log(`${checked} layout helpers reject writes after switching`);
"""
        result = subprocess.run(
            ["node", "--input-type=module", "-", str(Path(SPEC.origin).parent)],
            input=script, capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
