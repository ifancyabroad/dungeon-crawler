# commit

Stage all current changes and commit them with an appropriate message.

1. Run `git diff` and `git status` to understand what has changed.
2. Analyze the changes to determine the nature of the work (new feature, bug fix, refactor, etc.).
3. Draft a concise commit message (1–2 sentences) focused on _why_ the change was made, not just what changed. Follow the style of recent commits in `git log --oneline -10`.
4. Stage all modified and untracked files relevant to the changes with `git add` — prefer adding specific files over `git add -A`. Do not stage files that likely contain secrets (e.g. `.env`).
5. Commit using a heredoc so formatting is preserved, and append the co-author trailer:

```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

6. Run `git status` after the commit to confirm it succeeded.
