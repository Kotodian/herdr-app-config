# PR Diff and human approval

Open a task's **Pull request** page, then **查看 Diff 并审核**. The large review dialog shows changed files on the left and an aligned comparison on the right, with line numbers, highlighted replacements and one shared scroll position. The arrow buttons, F7 and Shift+F7 jump between change groups. A unified view is available too.

**本地 Commit** compares the task's local branch commit with its merge base against the local target branch. Opening, refreshing, commenting and approving use local Git only, including when the task has a recorded GitHub PR. **Worktree 实时** includes uncommitted and untracked files. It reads the task's worktree even if the main checkout is clean. Binary files have no text preview; oversized previews are marked as truncated.

For a Ready task, finish committing before reviewing. Click **审核通过** to record approval for the displayed head and target base commits, then **合并到 dev/main** to request the merge. A requested GitHub merge checks the remote commits against the approved local commits, the project's branch policy and GitHub checks. A queued merge is shown as queued, not completed.

Click **+** at the far left of a source row to open an inline editor above that row, in the left comparison column. Clicking code itself does not open comments. The row determines the comment location automatically. **保存评论** leaves the saved comment above its source row; repeat on other lines for multiple comments. **取消** closes the editor. **要求修改** sends all draft comments for the displayed version to the worker in one message, with file names, line positions and comment IDs. It revokes approval and puts the task back into Working. The worker must address each comment, run checks and return to Ready with its responses in Details. Comment history is retained in the task; the person reviews again and decides whether to approve. These comments are stored in Herdr's task record; they do not post GitHub review comments.

When `git-workflow.json` has `"human_review_required": true`, Herdr's Accept, Merge, scheduler and merge-queue retries require this approval. An agent's review verdict does not grant it. A changed head or target base invalidates the recorded approval; uncommitted work also blocks merging. A local branch must fast-forward exactly to the reviewed commit: updating or rebasing it requires another review.

The approval gate applies to Herdr's merge operations. It does not configure GitHub repository protection or restrict Git commands run outside Herdr.

The read-only CLI is `herdr-task review-diff REF --json`, with optional `--path PATH` or `--working`. UI approval uses `approve-review REF --snapshot TOKEN`; this command refuses coding-agent sessions. Missing local PR/base commit objects produce a fetch-and-refresh message rather than displaying a different comparison.
