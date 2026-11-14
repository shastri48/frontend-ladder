---
title: Git Fundamentals & Production Workflows
summary: How Git really stores history, branching, merge vs rebase, resolving conflicts, stash, and the safe way to undo a commit that's already pushed.
minutes: 20
---

## Git's mental model

Git is a database of **snapshots**. Each **commit** stores:

- a full snapshot of your project (efficiently, via content-addressed blobs/trees),
- a pointer to its **parent** commit(s),
- author, date, message,
- an ID — the SHA hash of all of the above.

A **branch** is just a movable pointer (a 41-byte file) to a commit. `HEAD` points to the branch you're on. That's why branches are cheap — create them freely.

```text
          feature
             ↓
     C ── D ── E
    /
A ── B ── F ── G
               ↑
             main ← HEAD
```

### The three areas

```text
Working directory  ──git add──▶  Staging area (index)  ──git commit──▶  Repository (history)
     (your files)                 (next snapshot)                         (.git)
```

```bash
git status                  # what changed, what's staged
git diff                    # unstaged changes
git diff --staged           # staged changes
git add src/App.tsx         # stage a file
git add -p                  # stage hunk by hunk (review what you commit!)
git commit -m "feat: add cart badge"
git log --oneline --graph --all
```

## Remote collaboration

```bash
git clone git@github.com:org/app.git
git switch -c feature/cart-badge     # create + switch (modern; = git checkout -b)
git push -u origin feature/cart-badge
git fetch                            # download remote changes, don't touch your files
git pull                             # fetch + merge (or rebase, if configured) into current branch
```

`origin` is just the default name of the remote. `origin/main` is your local copy of where `main` was on the remote at the last fetch.

A typical team flow (GitHub flow / trunk-based):

1. Branch off `main`.
2. Small commits; push; open a **Pull Request**.
3. CI runs tests/lint; teammates review.
4. Merge (merge commit, squash, or rebase-merge) → deploy.

**Conventional commits** (`feat:`, `fix:`, `chore:`, `refactor:`) make history readable and enable automatic changelogs.

## Merge vs rebase

Both integrate changes from one branch into another.

**Merge** creates a new commit with two parents. History is preserved exactly as it happened.

```text
A ── B ── F ── G ────── M   (main)
      \               /
       C ── D ── E ───      (feature)
```

**Rebase** replays your commits on top of the target, creating **new** commits (new hashes). History becomes linear.

```text
A ── B ── F ── G ── C' ── D' ── E'   (feature, rebased onto main)
```

| | Merge | Rebase |
|---|---|---|
| History | True, with merge commits | Linear, cleaner |
| Rewrites commits? | No | **Yes** (new SHAs) |
| Safe on shared branches? | Yes | **No** — never rebase commits others have pulled |
| Conflict resolution | Once | Possibly per replayed commit |

Golden rule: **rebase your own local/feature branch freely; never rebase a public shared branch** (like `main`). Use `git pull --rebase` to avoid noisy "Merge branch 'main'" commits on your feature branch.

Interactive rebase (`git rebase -i HEAD~4`) lets you squash, reword, reorder or drop commits before opening a PR.

## Resolving merge conflicts

A conflict happens when both branches changed the **same lines** (or one deleted a file the other edited). Git stops and marks the file:

```text
<<<<<<< HEAD
const TAX = 0.18
=======
const TAX = 0.12
>>>>>>> feature/new-tax
```

Process:

```bash
git merge main            # or: git rebase main
git status                # lists conflicted files
# edit each file: keep one side, the other, or a combination; delete markers
npm test                  # make sure it actually works
git add src/tax.ts
git commit                # for merge   |  git rebase --continue  for rebase
# bail out entirely:
git merge --abort         |  git rebase --abort
```

Tips: pull/rebase from `main` often (small conflicts beat huge ones); use your editor's 3-way merge view; talk to the other author when the intent is unclear; run tests after resolving — a conflict-free merge can still be semantically wrong.

## Undoing things (the most-asked part)

| Situation | Command | Rewrites history? |
|---|---|---|
| Discard unstaged changes in a file | `git restore file` | No |
| Unstage a file | `git restore --staged file` | No |
| Fix the last commit message / add a forgotten file (not pushed) | `git commit --amend` | Yes (last commit) |
| Throw away local commits (not pushed) | `git reset --hard HEAD~2` | Yes |
| Undo commits but keep changes | `git reset --soft HEAD~1` (staged) / `--mixed` (unstaged) | Yes |
| **Undo a commit already pushed to a shared branch** | **`git revert <sha>`** | **No** — adds a new inverse commit |
| Recover "lost" commits after a bad reset | `git reflog` then `git reset --hard <sha>` | — |

### Reverting a pushed commit — the production answer

```bash
git log --oneline              # find the bad commit, e.g. a1b2c3d
git revert a1b2c3d             # creates a new commit that undoes it
git push                       # safe: history only moves forward
```

- Revert a **merge commit**: `git revert -m 1 <merge-sha>` (keep parent 1, i.e. main's side).
- Revert a range: `git revert --no-commit A^..B` then commit once.

Why not `git reset` + `git push --force`? Force-pushing rewrites history everyone else has; their next pull breaks, and you may delete teammates' commits. If you truly must force-push your own branch, use `git push --force-with-lease`, which refuses if the remote changed since you last fetched.

:::callout tip reset modes
`--soft` moves the branch pointer only (changes stay staged). `--mixed` (default) also unstages. `--hard` also discards working-directory changes — the only one that can lose work (though `reflog` can usually save committed work).
:::

## Switching branches safely: stash

You're mid-change and need to hotfix `main`:

```bash
git stash push -m "wip cart badge"   # shelve changes (add -u to include untracked files)
git switch main
git switch -c hotfix/login
# ...fix, commit, push...
git switch feature/cart-badge
git stash list
git stash pop                        # re-apply and drop (or: git stash apply to keep it)
```

Alternatives: commit a WIP commit and amend later, or use `git worktree add ../hotfix main` to check out a second branch in another folder simultaneously.

## Other useful commands

```bash
git cherry-pick <sha>        # copy one commit onto current branch (e.g. hotfix to release branch)
git bisect start / good / bad  # binary-search which commit introduced a bug
git blame -L 10,30 file.ts   # who changed these lines and why
git tag v1.4.0 && git push --tags
git log -S "functionName"    # find commits that added/removed a string
```

`.gitignore` keeps `node_modules/`, `dist/`, `.env` and editor files out of the repo. **Never commit secrets** — if you do, rotate the secret immediately; removing it from history isn't enough once pushed.

:::question
difficulty: easy
companies: Accenture
### What command do you use to revert a commit that's already pushed to the remote?
`git revert <commit-sha>` then `git push`. Revert creates a **new** commit that applies the inverse of the bad commit, so history moves forward and nobody else's clone breaks. For a merge commit use `git revert -m 1 <sha>`. Avoid `git reset` + force push on shared branches: it rewrites public history, can drop teammates' commits and breaks their local branches. If you must rewrite your own branch, use `--force-with-lease`.
:::

:::question
difficulty: medium
companies: Accenture
### How do you safely switch branches or handle merge conflicts in production?
Switching: commit or `git stash` your work first (or use `git worktree`), then `git switch`. For a hotfix, branch from the production branch/tag, make the minimal fix, open a PR, let CI run, merge, deploy, then merge/cherry-pick the fix back into `main`/develop.

Conflicts: update your branch from the target frequently to keep conflicts small; on conflict, inspect each conflicted file, understand both intents (ask the other author), resolve, remove markers, run tests/build, then `git add` + `git commit` (or `git rebase --continue`). Abort with `--abort` if needed. Never resolve conflicts directly on `main` under pressure without CI; never force-push shared branches.
:::

:::question
difficulty: medium
### What is the difference between `git merge` and `git rebase`?
Merge integrates branches by creating a merge commit with two parents, preserving exact history. Rebase replays your commits on top of another branch, producing new commits and a linear history. Rebase rewrites history, so only use it on branches that haven't been shared (or that you alone own); merge is always safe for shared branches. Teams often rebase feature branches locally to stay up to date and squash-merge PRs into main.
:::

:::question
difficulty: medium
### What's the difference between `git reset` and `git revert`?
`reset` moves the current branch pointer back to an earlier commit, effectively deleting later commits from the branch (`--soft` keeps changes staged, `--mixed` unstaged, `--hard` discards them) — it rewrites history and is meant for local, unpushed work. `revert` creates a new commit that undoes a previous commit's changes, preserving history — the right tool for anything already pushed.
:::

:::question
difficulty: easy
### What is the difference between `git fetch` and `git pull`?
`git fetch` downloads new commits and updates remote-tracking branches (`origin/main`) without touching your working files or current branch. `git pull` = `fetch` + integrate (merge by default, or rebase with `--rebase` / `pull.rebase=true`) into your current branch.
:::

:::challenge
difficulty: medium
### Scenario: the bad deploy
It's Friday. A teammate merged PR #482 (merge commit `9f3e1a2`) into `main` an hour ago; it broke checkout in production. Two other PRs have been merged after it. Your branch `feature/search` has uncommitted work. What exact commands do you run to roll back #482's changes safely and get back to your work afterwards?
@@@solution
```bash
# 1. Shelve your work
git stash push -u -m "wip search"

# 2. Get the latest main
git switch main
git pull --ff-only

# 3. Create a branch for the revert (main is usually protected)
git switch -c revert/pr-482

# 4. Revert the merge commit, keeping main's side (parent 1)
git revert -m 1 9f3e1a2
#    resolve conflicts if later PRs touched the same lines, run tests

# 5. Push and open a PR; CI runs, get a quick review, merge, deploy
git push -u origin revert/pr-482

# 6. Back to your work
git switch feature/search
git stash pop
```
Why this way:
- `revert` doesn't rewrite history — the two later PRs stay intact and nobody's clone breaks.
- `-m 1` is required for merge commits to tell Git which parent is the "mainline".
- `--ff-only` makes sure you don't accidentally create a merge commit on local main.
- Later, to re-land the feature, the author must **revert the revert** (`git revert <revert-sha>`) or re-apply the changes — merging the original branch again won't re-add commits Git thinks are already in history.
- Also consider: a feature flag would have let you turn it off without any deploy.
:::

:::quiz
### Which command is safe to undo a commit on a shared branch?
- [ ] `git reset --hard HEAD~1 && git push -f`
- [x] `git revert <sha>`
- [ ] `git commit --amend`
@@@explain
Revert adds a new commit; the others rewrite history.
:::

:::quiz
### You need to fix a bug on main, but your current branch has uncommitted changes. Quickest safe option?
- [x] `git stash`, switch branches, fix, come back, `git stash pop`
- [ ] `git reset --hard`
- [ ] Commit directly on main
@@@explain
Stash shelves changes without losing them.
:::

:::quiz
### What does `git reflog` help with?
- [ ] Viewing remote branches
- [x] Finding commits HEAD pointed to recently, to recover "lost" work
- [ ] Rewriting commit messages
@@@explain
Reflog records every movement of HEAD locally, so you can reset back after a mistaken reset or rebase.
:::
