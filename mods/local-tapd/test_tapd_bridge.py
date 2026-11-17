import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("tapd_bridge", Path(__file__).with_name("tapd_bridge.py"))
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)

def reply(data):
    return {"status": 1, "data": data}

class Client:
    nick = "alice"

    def __init__(self):
        self.posts = []
        self.queries = []
        self.raw = {"id": "1112345678900", "title": "Bug", "status": "start", "current_owner": "bob;",
                    "modified": "2026-11-17 10:00", "reporter": "alice", "description": "Description"}

    def get_user_participant_projects(self, args):
        return reply([{"Workspace": {"id": "12345678", "name": "Project", "category": "project", "status": "normal"}}])

    def get_workspace_users(self, args):
        return reply([{"UserWorkspace": {"user": name, "name": name.title()}} for name in ("alice", "bob")])

    def get_workflows_status_map(self, args):
        return reply({"start": "新", "in_progress": "处理中", "closed": "已关闭"})

    def get_workflows_last_steps(self, args):
        return reply({"closed": "已关闭"})

    def get_workflows_all_transitions(self, args):
        return reply([{"StepPrevious": "start", "StepNext": "in_progress", "Appendfield": [
            {"FieldName": "remarks", "FieldLabel": "说明", "Notnull": "yes"}]},
            {"StepPrevious": "start", "StepNext": "end"}])

    def get_bug(self, args):
        self.queries.append(dict(args))
        return reply([{"Bug": dict(self.raw)}])

    def update_bug(self, args):
        self.posts.append(dict(args))
        self.raw.update({key: args[key] for key in ("status", "current_owner") if key in args})
        return reply({"Bug": dict(self.raw)})

class TapdOperations(unittest.TestCase):
    def setUp(self):
        self.client = Client()
        self.ref = {"workspace": "12345678", "id": self.client.raw["id"]}

    def update(self, changes, expected=None):
        before = {key: self.client.raw[key] for key in ("modified", "status", "current_owner")}
        return bridge.dispatch(self.client, {**self.ref, "action": "update",
                                             "expected": before if expected is None else expected, "changes": changes})

    def test_selected_owner_filters_query_and_exact_response(self):
        result = bridge.dispatch(self.client, {"action": "snapshot", "owner": "bob"})
        self.assertEqual(result["owner"], "bob")
        self.assertEqual(len(result["bugs"]), 1)
        self.assertEqual(self.client.queries[0]["current_owner"], "bob")
        self.assertEqual(bridge.dispatch(self.client, {"action": "snapshot"})["bugs"], [])

    def test_invalid_owner_cannot_make_an_unfiltered_query(self):
        with self.assertRaises(bridge.PanelError):
            bridge.dispatch(self.client, {"action": "snapshot", "owner": "unknown"})
        self.assertEqual(self.client.queries, [])

    def test_accessible_other_owners_bug_can_be_read_and_attached(self):
        result = bridge.dispatch(self.client, {**self.ref, "action": "detail"})
        self.assertEqual(result["current_owner"], "bob;")

    def test_inaccessible_project_cannot_be_read_or_updated(self):
        with self.assertRaises(bridge.PanelError):
            bridge.dispatch(self.client, {**self.ref, "workspace": "99999999", "action": "update"})
        self.assertEqual(self.client.posts, [])

    def test_options_only_contain_current_state_and_actual_destinations(self):
        result = bridge.dispatch(self.client, {**self.ref, "action": "options"})
        self.assertEqual([s["key"] for s in result["statuses"]], ["start", "in_progress"])
        self.assertEqual(result["statuses"][1]["fields"][0]["label"], "说明")
        self.assertEqual(self.client.posts, [])

    def test_transfer_only_changes_owner(self):
        result = self.update({"current_owner": "alice"})
        self.assertEqual(result["current_owner"], "alice;")
        self.assertNotIn("status", self.client.posts[0])
        self.assertEqual(result["description"], "Description")

    def test_status_change_preserves_owner_and_passes_required_fields(self):
        result = self.update({"status": "in_progress", "fields": {"remarks": "开始排查", "workspace_id": "evil"}})
        self.assertEqual(result["status"], "in_progress")
        self.assertEqual(self.client.posts[0]["current_owner"], "bob;")
        self.assertEqual(self.client.posts[0]["remarks"], "开始排查")
        self.assertEqual(self.client.posts[0]["workspace_id"], "12345678")

    def test_stale_update_is_rejected_before_write(self):
        with self.assertRaises(bridge.PanelError):
            self.update({"current_owner": "alice"}, {"modified": "old"})
        self.assertEqual(self.client.posts, [])

    def test_invalid_owner_transition_and_missing_fields_cannot_write(self):
        for changes in ({"current_owner": "unknown"}, {"status": "closed"}, {"status": "in_progress"}):
            with self.assertRaises(bridge.PanelError):
                self.update(changes)
        self.assertEqual(self.client.posts, [])

if __name__ == "__main__":
    unittest.main()
