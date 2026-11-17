"""Read-only incremental Issue polling, driven by Autopilot's existing scheduler."""
import datetime
import json
import os
import re
from .base import run

INTERVAL = 60000


def repository_folder(folder):
    """Skip non-repositories cheaply; nested working folders are allowed."""
    if not folder or not os.path.isdir(folder):
        return False
    at = os.path.abspath(folder)
    while True:
        if os.path.exists(os.path.join(at, ".git")):
            return True
        parent = os.path.dirname(at)
        if at == parent:
            return False
        at = parent


def iso(ms):
    return datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def poll(folder, previous, at):
    """No locks. Failure must leave the caller's cursor and pending Issues intact."""
    remote = run(["git", "-C", folder, "remote", "get-url", "origin"], timeout=5)
    match = re.fullmatch(r"(?:https://github\.com/|git@github\.com:|ssh://git@github\.com/)([\w.-]+)/([\w.-]+?)/?", remote.stdout.strip())
    if remote.returncode or not match:
        return {"folder": folder, "checked": at, "repo": None}
    repo = f"{match[1]}/{re.sub(r'[.]git$', '', match[2])}"
    baseline = previous.get("folder") != folder or previous.get("repo") != repo or not previous.get("cursor")
    cursor = iso(at)
    since = iso(at - 1000) if baseline else iso(
        datetime.datetime.fromisoformat(previous["cursor"].replace("Z", "+00:00")).timestamp() * 1000 - 1000)
    result = run(["gh", "api", "--paginate", "--slurp",
        f"repos/{repo}/issues?state=all&sort=updated&direction=asc&since={since}&per_page=100"], timeout=20)
    if result.returncode:
        raise ValueError("GitHub Issue 监听读取失败，请检查 gh 登录和仓库权限。")
    pages = json.loads(result.stdout)
    if not isinstance(pages, list):
        raise ValueError("GitHub Issue 监听返回格式异常。")
    rows = [x for page in pages for x in (page if isinstance(page, list) else [page]) if not x.get("pull_request")]
    seen = {} if baseline else dict(previous.get("seen") or {})
    updates = {}
    for x in rows:
        number, stamp = x.get("number"), x.get("updated_at")
        if not isinstance(number, int) or not stamp:
            continue
        key = str(number)
        if not baseline and seen.get(key) != stamp:
            updates[key] = {"number": number, "title": re.sub(r"\s+", " ", str(x.get("title") or ""))[:200], "state": x.get("state"),
                            "updated": stamp, "url": f"https://github.com/{repo}/issues/{number}"}
        seen[key] = stamp
    # Only overlapping timestamps need deduplication; bound long-lived state.
    seen = dict(sorted(seen.items(), key=lambda x: x[1])[-2000:])
    return {"folder": folder, "repo": repo, "checked": at, "cursor": cursor, "seen": seen,
            "updates": updates, "baseline": baseline}
