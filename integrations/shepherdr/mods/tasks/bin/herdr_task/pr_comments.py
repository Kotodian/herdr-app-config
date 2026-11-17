"""Publish the person's comments at their original GitHub diff location."""
import json

from .base import Fail
from . import github


def gh(*args):
    return github.gh(*args)


def marker(s, t, c):
    return f"<!-- herdr-human-comment:{s.ref(t)}:{c['id']} -->"


def response(ok, out, error):
    if not ok:
        raise Fail(error or "GitHub comment synchronization failed; the original comment is still saved.")
    try:
        value = json.loads(out)
    except (ValueError, TypeError):
        raise Fail("GitHub returned an unreadable response; retry synchronization.")
    if value.get("errors"):
        raise Fail("; ".join(e.get("message", "GitHub error") for e in value["errors"]))
    return value


def threads(pr):
    owner, repo = pr["repo"].split("/", 1)
    query = """query($owner:String!,$repo:String!,$number:Int!,$after:String){
      repository(owner:$owner,name:$repo){pullRequest(number:$number){
        reviewThreads(first:100,after:$after){nodes{
          id isResolved viewerCanResolve viewerCanUnresolve
          comments(first:1){nodes{id databaseId url body}}
        } pageInfo{hasNextPage endCursor}}
      }}
    }"""
    found, cursor = [], None
    for _ in range(100):
        args = ["api", "graphql", "-f", f"query={query}", "-f", f"owner={owner}",
                "-f", f"repo={repo}", "-F", f"number={pr['number']}"]
        if cursor:
            args += ["-f", f"after={cursor}"]
        data = response(*gh(*args))
        try:
            page = data["data"]["repository"]["pullRequest"]["reviewThreads"]
            found.extend(page["nodes"])
            if not page["pageInfo"]["hasNextPage"]:
                return found
            following = page["pageInfo"]["endCursor"]
            if not following or following == cursor:
                break
            cursor = following
        except (TypeError, KeyError):
            raise Fail("Couldn't read this PR's review threads; retry synchronization.")
    raise Fail("Couldn't finish reading the PR's review threads; no duplicate comments were posted.")


def attach(c, pr, posted, thread=None):
    previous = c.get("pr_comment") or {}
    if previous.get("id") and previous.get("id") != posted.get("id"):
        legacy = c.setdefault("pr_comment_legacy", [])
        if previous not in legacy:
            legacy.append(previous)
    meta = {"id": posted["id"], "url": posted["html_url"], "repo": pr["repo"],
            "number": pr["number"], "kind": "review" if c.get("path") else "issue"}
    if posted.get("node_id"):
        meta["node_id"] = posted["node_id"]
    if thread:
        meta.update(thread_id=thread["id"], is_resolved=thread["isResolved"],
                    can_resolve=thread["viewerCanResolve"], can_reopen=thread["viewerCanUnresolve"])
        apply_resolution(c, thread["isResolved"])
    c["pr_comment"] = meta
    c.pop("pr_sync_error", None)


def apply_resolution(c, resolved):
    if resolved:
        if c.get("status") != "resolved":
            c["resolved_from"] = c.get("status", "commented")
        c["status"] = "resolved"
    elif c.get("status") == "resolved":
        c["status"] = c.pop("resolved_from", "commented")


def from_threads(s, t, c, found):
    key = marker(s, t, c)
    for thread in found:
        for item in thread["comments"]["nodes"]:
            if key in (item.get("body") or ""):
                return {"id": item["databaseId"], "html_url": item["url"], "node_id": item["id"]}, thread
    return None, None


def sync(s, t):
    pr = t["pr"]
    comments = [c for c in t.get("human_comments") or [] if c.get("by") == "person"
                and c.get("status") in ("changes", "commented", "resolved")]
    located = [c for c in comments if c.get("path")]
    found, thread_error = [], None
    if located:
        try:
            found = threads(pr)
        except Fail as e:
            thread_error = str(e)
    general = [c for c in comments if not c.get("path") and not c.get("pr_comment")]
    existing, general_error = [], None
    if general:
        ok, out, error = gh("api", "--paginate", f"repos/{pr['repo']}/issues/{pr['number']}/comments",
                            "--jq", ".[] | {id,html_url,body} | @json")
        try:
            if not ok:
                raise Fail(error or "Couldn't read PR comments.")
            existing = [json.loads(line) for line in out.splitlines() if line.strip()]
        except (ValueError, TypeError, Fail) as e:
            general_error = str(e)
    created = []
    for c in comments:
        if not c.get("path") and c.get("pr_comment"):
            continue
        s.dirty = True
        try:
            if c.get("path"):
                if thread_error:
                    raise Fail(thread_error)
                posted, thread = from_threads(s, t, c, found)
                if not posted:
                    # Reuse the immutable original head, never attach an old comment to a new line.
                    if not c.get("head"):
                        raise Fail("The comment's original commit is missing; it was not posted to another line.")
                    args = ["api", "-X", "POST", f"repos/{pr['repo']}/pulls/{pr['number']}/comments",
                            "-f", f"body={c['body']}\n\n{marker(s, t, c)}",
                            "-f", f"commit_id={c['head']}", "-f", f"path={c['path']}"]
                    if c.get("line") is not None:
                        args += ["-F", f"line={c['line']}", "-f", f"side={c.get('side', 'RIGHT')}"]
                    else:
                        args += ["-f", "subject_type=file"]
                    posted = response(*gh(*args))
                    if not posted.get("id") or not posted.get("html_url"):
                        raise Fail("GitHub comment response incomplete; retry to recover the published comment.")
                    created.append(c)
                attach(c, pr, posted, thread)
            else:
                if general_error:
                    raise Fail(general_error)
                posted = next((x for x in existing if marker(s, t, c) in (x.get("body") or "")), None)
                if not posted:
                    posted = response(*gh("api", "-X", "POST",
                        f"repos/{pr['repo']}/issues/{pr['number']}/comments",
                        "-f", f"body={c['body']}\n\n{marker(s, t, c)}"))
                if not posted.get("id") or not posted.get("html_url"):
                    raise Fail("GitHub comment response incomplete; retry synchronization.")
                attach(c, pr, posted)
        except Fail as e:
            c["pr_sync_error"] = str(e)
    if created:
        try:
            found = threads(pr)
            for c in created:
                posted, thread = from_threads(s, t, c, found)
                if posted:
                    attach(c, pr, posted, thread)
                else:
                    c["pr_sync_error"] = "评论已发布到代码行，线程状态尚未同步，请重试。"
        except Fail as e:
            for c in created:
                c["pr_sync_error"] = str(e)


def resolve(s, t, comment_id, reopen=False):
    c = next((c for c in t.get("human_comments") or [] if c.get("id") == comment_id), None)
    if not c or c.get("by") != "person" or c.get("status") == "draft" or not c.get("path"):
        raise Fail("Only a submitted code review thread can be resolved or reopened.")
    sync(s, t)
    meta = c.get("pr_comment") or {}
    if not meta.get("thread_id") or c.get("pr_sync_error"):
        raise Fail(c.get("pr_sync_error") or "Sync this comment to its GitHub code review thread first.")
    desired = not reopen
    if meta.get("is_resolved") == desired:
        return
    if not meta.get("can_reopen" if reopen else "can_resolve"):
        raise Fail("The current GitHub account cannot reopen this thread." if reopen
                   else "The current GitHub account cannot resolve this thread.")
    action = "unresolveReviewThread" if reopen else "resolveReviewThread"
    query = f"""mutation($id:ID!){{{action}(input:{{threadId:$id}}){{
      thread{{id isResolved viewerCanResolve viewerCanUnresolve}}
    }}}}"""
    data = response(*gh("api", "graphql", "-f", f"query={query}", "-f", f"id={meta['thread_id']}"))
    try:
        thread = data["data"][action]["thread"]
        if thread["id"] != meta["thread_id"] or thread["isResolved"] != desired:
            raise KeyError("unexpected thread state")
    except (TypeError, KeyError):
        raise Fail("GitHub hasn't confirmed the requested thread state. Refresh before trying again.")
    meta.update(is_resolved=desired, can_resolve=thread["viewerCanResolve"],
                can_reopen=thread["viewerCanUnresolve"])
    apply_resolution(c, desired)
    c.pop("pr_sync_error", None)
    s.dirty = True
