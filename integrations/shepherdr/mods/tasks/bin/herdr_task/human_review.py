"""The person's PR review: immutable commit diffs and approval of that exact comparison."""
import hashlib
import json
import os
import re
import secrets

from .base import Fail, now, run
from .workflow import policy

READ = ["--no-optional-locks", "--literal-pathspecs", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false"]
MAX_FILES, MAX_PATCH = 1000, 600_000


def sync_comments(s, t):
    """Publish submitted human feedback to the PR; opening a diff and saving drafts stay local."""
    pr = t.get("pr") or {}
    if not (policy() or {}).get("publish_review_comments") or not pr.get("number") or not pr.get("repo"):
        return
    if not t.get("human_comments"):
        return
    from .pr_comments import sync
    sync(s, t)


def required(t):
    return bool((policy() or {}).get("human_review_required") and t.get("mode") == "worktree"
                and not t.get("nothing_to_merge"))


def git(folder, *args, allow_failure=False):
    result = run(["git", *READ, "-C", folder, *args])
    if result.returncode and not allow_failure:
        raise Fail((result.stderr or result.stdout).strip() or "Couldn't read this task's Git comparison.")
    return result


def commit(folder, ref):
    result = git(folder, "rev-parse", "--verify", ref + "^{commit}", allow_failure=True)
    sha = result.stdout.strip()
    if result.returncode or not re.fullmatch(r"[0-9a-f]{40,64}", sha):
        raise Fail("The task's branch or base commit isn't available locally. Check the local branches, then refresh.")
    return sha


def comparison(s, t):
    folder = s.loc["folder"]
    branch, base = t.get("branch"), t.get("base")
    if not branch or not base:
        raise Fail("This task has no branch and base to compare.")
    head = commit(folder, "refs/heads/" + branch) if git(
        folder, "show-ref", "--verify", "--quiet", "refs/heads/" + branch, allow_failure=True
    ).returncode == 0 else commit(folder, t.get("head") or branch)
    base_head = commit(folder, "refs/heads/" + base)
    pr = t.get("pr") or {}
    merge_base = git(folder, "merge-base", base_head, head).stdout.strip()
    wt = t.get("worktree")
    dirty, working_head = [], None
    if wt and os.path.isdir(wt):
        working_head = commit(wt, "HEAD")
        dirty = [entry[3:] for entry in git(
            wt, "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"
        ).stdout.split("\0") if entry]
    identity = {"task": s.ref(t), "branch": branch, "base": base, "head": head,
                "base_head": base_head, "merge_base": merge_base,
                "pr": {"number": pr.get("number"), "repo": pr.get("repo")}}
    token = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    approved = (t.get("human_review") or {}).get("snapshot") == token
    same_head = working_head is None or working_head == head
    return {**identity, "snapshot": token, "approved": approved, "dirty": dirty,
            "title": t.get("title") or s.ref(t), "pr_url": pr.get("url"),
            "worktree": wt, "local_matches": same_head, "state": t["state"],
            "required": required(t), "approval": t.get("human_review"),
            "comments": t.get("human_comments") or [], "reviews": t.get("human_reviews") or []}


def review_diff(s, t, path=None, working=False, comment_id=None):
    review = comparison(s, t)
    if comment_id:
        if working:
            raise Fail("A saved review comment refers to a committed version, not the live worktree.")
        c = next((c for c in t.get("human_comments") or [] if c.get("id") == comment_id), None)
        if not c or not c.get("path") or not c.get("head"):
            raise Fail("This review comment has no saved code location.")
        original_head = commit(s.loc["folder"], c["head"])
        original_base = commit(s.loc["folder"], c.get("base_head") or t.get("start") or review["merge_base"])
        original_merge = commit(s.loc["folder"], c["merge_base"]) if c.get("merge_base") else git(
            s.loc["folder"], "merge-base", original_base, original_head).stdout.strip()
        review.update(head=original_head, base_head=original_base, merge_base=original_merge,
                      snapshot=c["snapshot"], approved=False, approval=None, historical=True,
                      dirty=[], local_matches=True, comment_id=comment_id,
                      anchor={k: c.get(k) for k in ("path", "line", "side")})
        path = path or c["path"]
    folder, end = s.loc["folder"], review["head"]
    if working:
        if not review["worktree"] or not os.path.isdir(review["worktree"]):
            raise Fail("This task's worktree is no longer on disk. Its committed PR diff is still available.")
        folder, end = review["worktree"], None
    revisions = [review["merge_base"], *([end] if end else [])]
    common = ["diff", "--no-ext-diff", "--no-textconv", "--no-color", "--no-renames"]
    names = git(folder, *common, "--name-status", "-z", *revisions, "--").stdout.split("\0")
    nums = git(folder, *common, "--numstat", "-z", *revisions, "--").stdout.split("\0")
    stats = {}
    for entry in nums:
        a, _, rest = entry.partition("\t")
        d, _, name = rest.partition("\t")
        if name:
            stats[name] = {"add": int(a) if a.isdigit() else 0,
                           "del": int(d) if d.isdigit() else 0, "binary": a == "-"}
    files = [{"path": names[i + 1], "status": names[i], "fresh": False,
              **stats.get(names[i + 1], {})} for i in range(0, len(names) - 1, 2)]
    if working:
        files += [{"path": name, "status": "A", "fresh": True, "add": 0, "del": 0}
                  for name in git(folder, "ls-files", "--others", "--exclude-standard", "-z").stdout.split("\0") if name]
    files.sort(key=lambda f: f["path"])
    review.update(files=files[:MAX_FILES], file_count=len(files), limited=len(files) > MAX_FILES,
                  add=sum(f.get("add", 0) for f in files), delete=sum(f.get("del", 0) for f in files),
                  working=working)
    if path is not None:
        file = next((f for f in files if f["path"] == path), None)
        if not file:
            raise Fail("That path is not among this comparison's changed files.")
        result = git(folder, *common, "--unified=5", *revisions, "--", path, allow_failure=True) if not file["fresh"] else \
            git(folder, "diff", "--no-index", "--no-ext-diff", "--no-textconv", "--no-color", "--", "/dev/null", path,
                allow_failure=True)
        if result.returncode not in ((0, 1) if file["fresh"] else (0,)):
            raise Fail("Couldn't read this file's diff.")
        review["patch"] = {"path": path, "text": result.stdout[:MAX_PATCH],
                           "limited": len(result.stdout) > MAX_PATCH,
                           "binary": file.get("binary", False) or "\0" in result.stdout
                                     or bool(re.search(r"^Binary files ", result.stdout, re.M))}
    return review


def require_person():
    """Check before forwarding too: remote action helpers intentionally drop terminal labels."""
    if os.environ.get("CODEX_THREAD_ID") or os.environ.get("CLAUDE_CODE_ENTRYPOINT"):
        raise Fail("Only the person can approve a PR in its Diff review screen; agents cannot approve it.")
    if os.environ.get("HC_TERMINAL_ID"):
        from .launch import caller_labels
        labels = caller_labels()
        if labels.get("herdr.role") in ("worker", "reviewer", "coordinator") or labels.get("herdr.agent"):
            raise Fail("Only the person can approve a PR in its Diff review screen; agents cannot approve it.")


def approve(s, t, snapshot):
    require_person()
    current = review_diff(s, t)
    if t["state"] != "ready":
        raise Fail("The task must be Ready before the person approves it.")
    if current["snapshot"] != snapshot:
        raise Fail("The PR or its base changed since this Diff was opened. Refresh and review the new diff.")
    if current["dirty"] or not current["local_matches"]:
        raise Fail("The worktree has uncommitted changes or is on a different commit. Commit and refresh before approving.")
    if current["limited"]:
        raise Fail("This comparison exceeds the review file limit; reduce the task's scope before approving.")
    t["human_review"] = {k: current[k] for k in ("snapshot", "head", "base_head", "base", "branch", "pr")}
    t["human_review"].update(at=now(), by="person")
    for comment in t.get("human_comments") or []:
        if comment["snapshot"] == snapshot and comment.get("status") == "draft":
            comment["status"] = "commented"
    sync_comments(s, t)
    s.dirty = True
    return {**current, "approved": True, "approval": t["human_review"]}


def comment(s, t, snapshot, body=None, path=None, line=None, side="RIGHT", remove=None):
    require_person()
    current = comparison(s, t)
    if current["snapshot"] != snapshot:
        raise Fail("The local commit or base changed. Refresh before adding review comments.")
    if t["state"] == "done":
        raise Fail("This task is already done.")
    comments = t.setdefault("human_comments", [])
    if remove:
        found = next((c for c in comments if c["id"] == remove), None)
        if not found or found.get("status") != "draft" or found["snapshot"] != snapshot:
            raise Fail("Only a draft comment on the current version can be removed.")
        comments.remove(found)
    else:
        body = (body or "").strip()
        if not body or len(body) > 8000:
            raise Fail("A comment needs between 1 and 8,000 characters.")
        if len(comments) >= 200:
            raise Fail("This task already has 200 review comments.")
        if side not in ("LEFT", "RIGHT"):
            raise Fail("A line comment must name its old or new side.")
        if path:
            patch = review_diff(s, t, path)["patch"]
            if line is not None:
                # Only a displayed source line can receive a line comment.
                old = new = None
                valid = False
                for text in patch["text"].splitlines():
                    match = re.match(r"^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@", text)
                    if match:
                        old, new = map(int, match.groups())
                    elif old is not None:
                        if text.startswith(" "):
                            valid |= (old if side == "LEFT" else new) == line
                            old += 1
                            new += 1
                        elif text.startswith("-"):
                            valid |= side == "LEFT" and old == line
                            old += 1
                        elif text.startswith("+"):
                            valid |= side == "RIGHT" and new == line
                            new += 1
                if not valid:
                    raise Fail("That line is not in the displayed PR diff.")
        elif line is not None:
            raise Fail("A line comment needs a changed file.")
        comments.append({"id": secrets.token_hex(6), "snapshot": snapshot, "head": current["head"],
                         "base_head": current["base_head"], "merge_base": current["merge_base"],
                         "path": path, "line": line, "side": side, "body": body, "at": now(),
                         "by": "person", "status": "draft"})
    s.dirty = True
    return {**current, "comments": comments}


def request_changes(s, t, snapshot, args):
    require_person()
    current = comparison(s, t)
    if current["snapshot"] != snapshot:
        raise Fail("The local commit or base changed. Refresh and check your comments before requesting changes.")
    if t["state"] != "ready":
        raise Fail("The task must be Ready before you request changes.")
    if t.get("merge_queued") or t.get("auto_merge") or t.get("accepted_at"):
        raise Fail("A merge has already been requested. Cancel it on GitHub before requesting changes.")
    comments = [c for c in t.get("human_comments") or []
                if c["snapshot"] == snapshot and c.get("status") == "draft"]
    if not comments:
        raise Fail("Add at least one comment before requesting changes.")
    from .commands import tell, back_to_work
    import shlex
    lines = [f"The person requested changes to {s.ref(t)} at PR commit {current['head']}.",
             "Address every review comment below in this task's worktree. These are the person's review instructions:"]
    for c in comments:
        location = c.get("path") or "PR"
        if c.get("line") is not None:
            location += f":{c['line']} ({'old' if c['side'] == 'LEFT' else 'new'} side)"
        lines.append(f"\n[{c['id']}] {location}\n{c['body']}")
    lines.extend(["\nRun the project's checks, commit and push the fixes through herdr-task ready.",
                  "In --details, explain the response to every comment ID, including any you cannot resolve.",
                  f"Finish with: herdr-task ready {s.ref(t)} --folder {shlex.quote(s.loc['folder'])} "
                  '--summary "…" --details "…" .',
                  "Do not approve or merge. The person must review the new diff and click 审核通过 again."])
    # Approval is revoked before any agent is woken, including when starting the worker fails.
    t.pop("human_review", None)
    for key in ("auto_merge", "accepted_at", "merge_requested"):
        t.pop(key, None)
    s.dirty = True
    address, started = tell(s, t, "\n".join(lines), args)
    for c in comments:
        c["status"] = "changes"
    t.setdefault("human_reviews", []).append({"decision": "changes", "snapshot": snapshot,
        "head": current["head"], "comments": [c["id"] for c in comments], "at": now(), "by": "person"})
    t["fix_requested"] = t["handed_at"] = now()
    back_to_work(s, t, "the person requested changes in PR comments", "Fixing PR review comments")
    sync_comments(s, t)
    return {**current, "state": t["state"], "approved": False, "approval": None,
            "comments": t["human_comments"], "reviews": t["human_reviews"],
            "terminal": address, "new_agent": started}


def require_approval(s, t, remote=None):
    if not required(t):
        return None
    current = comparison(s, t)
    # The viewer and approval are local-only. A requested GitHub merge must still match exactly.
    if remote is not None and (remote.get("headRefOid") != current["head"]
                               or remote.get("baseRefOid") != current["base_head"]
                               or remote.get("baseRefName") != current["base"]):
        raise Fail("Human review required: GitHub and the reviewed local commits differ. "
                   "Update the local target branch or push the reviewed branch, then review the local Diff again.")
    if (not current["approved"] or current["dirty"] or not current["local_matches"]
            or (t.get("human_review") or {}).get("by") != "person"):
        raise Fail("Human review required: open this task's PR Diff and click 审核通过 for its current commits "
                   "before merging. A changed PR, base or worktree needs a new review.")
    return current


def cmd_review_diff(args):
    from .store import open_store
    from .output import say
    with open_store(args, write=False) as s:
        out = review_diff(s, s.find(args.id), getattr(args, "path", None), getattr(args, "working", False),
                          getattr(args, "comment_id", None))
    say(args, out, json.dumps(out, ensure_ascii=False))


def cmd_approve_review(args):
    from .store import open_store
    from .output import say
    with open_store(args) as s:
        out = approve(s, s.find(args.id), args.snapshot)
    say(args, out, "Review approved for " + out["head"][:8] + ". Merge is now available.")


def cmd_review_comment(args):
    from .store import open_store
    from .output import say
    with open_store(args) as s:
        out = comment(s, s.find(args.id), args.snapshot, args.body, args.path, args.line, args.side, args.remove)
    say(args, out, "Review comment saved.")


def cmd_request_changes(args):
    from .store import open_store
    from .output import say
    with open_store(args) as s:
        out = request_changes(s, s.find(args.id), args.snapshot, args)
    say(args, out, "Changes requested. The worker will address the review comments.")


def cmd_sync_review_comments(args):
    from .store import open_store
    from .output import say
    with open_store(args) as s:
        t = s.find(args.id)
        sync_comments(s, t)
        comments = t.get("human_comments") or []
        out = {"comments": comments, "pending": sum(bool(c.get("pr_sync_error")) for c in comments)}
    say(args, out, "Submitted human review comments synchronized to the PR.")


def cmd_resolve_review_comment(args):
    require_person()
    from .store import open_store
    from .output import say
    from .pr_comments import resolve
    with open_store(args) as s:
        t = s.find(args.id)
        if not (t.get("pr") or {}).get("number"):
            raise Fail("This task has no GitHub PR review thread.")
        resolve(s, t, args.comment_id, args.reopen)
        out = {"comments": t.get("human_comments") or []}
    say(args, out, "Review thread reopened." if args.reopen else "Review thread resolved.")
