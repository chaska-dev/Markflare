# Branching workflow

Parasti follows a simplified Git Flow: **`dev` → `staging` → `main`**, borrowed from
the upstream [Markflare](https://github.com/chaska-dev/Markflare) repository. Work
happens in short-lived branches, is integrated on `dev`, tested as a package on
`staging`, and only then released on `main`.

```
main      ════════════●═════════════●═════════▶   release, tagged
                        ▲            │
                        │          v0.2.0
staging   ─────●───────●────────●────▶   integration + QA
                ▲        │        │
                │        │        ▲
                │        └── fix ─┘   (small patches found during QA,
                │                      merged back from dev)
dev       ─●──●──●──●──●──●──●──────▶   daily integration
             ▲  ▲     ▲  ▲
             │  │     │  │
feature/* ──●  │     ●  │
fix/123   ─────●        │
chore/*  ───────────────●
```

## The branches

| Branch | Created from | Merged into | Direct commits? |
|---|---|---|---|
| `main` | `staging` | — (only tagged) | ❌ never |
| `staging` | `dev` | `main` | ❌ never — only receives merges from `dev` |
| `dev` | `main` (at project start) | `staging` | ⚠️ allowed, but prefer `feature/*` branches |
| `feature/*`, `fix/*`, `chore/*` | `dev` | `dev` | ✅ yes — this is the workspace |
| `hotfix/*` | `main` | `main` **and** `dev` | ✅ yes — emergencies only |

`main` is always buildable and runnable. Every release on `main` is tagged with a
semantic version (`v0.3.0`). Feature, fix, and hotfix branches are **deleted** after
their merge — only the four permanent branches ever remain.

## Naming conventions

- `feature/<short-name>` — new functionality (`feature/editor-preview`)
- `fix/<issue-or-topic>` — bug fixes (`fix/dropzone-phantom-file`)
- `chore/<topic>` — tooling, docs, refactors (`chore/migration-cleanup`)
- `hotfix/<topic>` — emergency fixes off `main`

Commit messages follow Conventional Commits, same as the upstream history:
`feat(editor): show feedback when a file is dropped into the page`.

## One release cycle

```bash
# 1. Cut a branch from dev and work on it
git switch dev
git switch -c feature/editor-preview
# …work, commit…

# 2. Integrate into dev
git switch dev
git merge feature/editor-preview
git branch -d feature/editor-preview
# → repeat for the other features of this cycle

# 3. Package it for testing
git switch staging
git merge dev
# → QA, polish, check cross-feature integration

# 4. Anything QA found gets fixed on dev, merged back into staging
git switch dev
git merge staging          # keep dev in sync with QA fixes

# 5. Release
git switch main
git merge staging
git tag v0.3.0

# 6. Sync back so the next cycle starts clean
git switch dev
git merge main
```

## Rules worth keeping

1. **`staging` is not a second `dev`.** It only ever receives merges from `dev`.
   Direct commits there are how the branch loses its purpose.
2. **`main` never sits stale.** If it hasn't moved in weeks while `dev` has, a
   release is overdue — package what's on `staging` and ship it.
3. **Hotfixes bypass the flow, both ways.** An emergency fix is cut from `main`,
   merged back to `main` immediately, *and* merged to `dev` so the next release
   doesn't reintroduce the bug.
4. **Branches die after merge.** A long-lived `feature/*` branch is a merge
   conflict waiting to happen; keep them days old, not months.
