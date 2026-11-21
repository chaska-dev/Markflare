# Version numbering

Parasti versions follow [Semantic Versioning 2.0.0](https://semver.org/) with a
`v` prefix: **`vMAJOR.MINOR.PATCH`** (for example `v1.2.3`). The first release
was `v1.0.0`; the `v0.x` numbers in `BRANCHING.md` are upstream history from
Markflare, not this project's.

```
v1.2.3
│ │ │
│ │ └── PATCH  bug fixes, hotfixes, docs, dependency bumps
│ └────── MAJOR.MINOR: new features, additive API/migrations
└────────── MAJOR: breaking changes
```

## What bumps what

| Bump | When | Examples |
|---|---|---|
| **MAJOR** | Existing deployments or data would break on update | Removing or renaming an HTTP route or its response shape; a migration that rewrites or drops user data; an env var or config key that stops working; changes requiring manual steps to upgrade |
| **MINOR** | New functionality, fully backwards-compatible | New block type, new API route, new UI section, **additive** migrations (new tables/columns), new feature flags |
| **PATCH** | Fixes that change no behavior users depend on | Bug fixes, `hotfix/*` releases off `main`, docs, dependency updates, build/tooling fixes |

Tie-breakers:

- A migration file is **additive** (new tables, new nullable columns, new
  indexes) → at least MINOR. Anything that transforms existing rows or removes
  a column → MAJOR.
- Uncertain whether a change is MAJOR or MINOR → treat it as MAJOR.
- One release = one bump. If a cycle contains both a feature and a fix, it is
  one MINOR release, not two.

## Conventional Commits map the bump

Version is derived from the commit history of the cycle, same as the upstream
history:

- `fix:*`, `chore:*`, `docs:*` → PATCH
- `feat:*` → MINOR
- `feat!:` or any commit with a `BREAKING CHANGE:` footer → MAJOR

## Pre-releases for staging

Code on `staging` is QA material, never a release. If a build needs to be
referenced before it ships, use a SemVer pre-release of the *next* planned
version, never a plain tag on `staging`:

```
v1.1.0-beta.1   first QA build for the 1.1.0 cycle
v1.1.0-rc.1     candidate, only regression fixes expected
v1.1.0          the actual release, tagged on main
```

Pre-release tags are disposable: they may point at `staging` commits, and they
never block `main`.

## Where the version lives

1. During a cycle, `package.json` keeps the version of the **last** release.
2. When cutting a release, one `chore(release): v1.1.0` commit updates
   `package.json` (and any other manifest carrying the number) and is merged
   into `main` together with `staging`.
3. Tag `main` with an **annotated** tag right after the merge:
   `git tag -a v1.1.0 -m "Parasti 1.1.0"`.
4. Hotfixes repeat the same steps with the next PATCH: bump, merge to `main`
   *and* `dev`, tag.

Tag names are always lowercase `v` + the exact `package.json` version. There
is exactly one tag per release; re-tagging a different commit with the same
name is forbidden — fix forward with a new PATCH instead.

## The MCP package versions independently

The `mcp/` npm package (`parasti-mcp`) carries its **own** SemVer, unrelated to
the app version above. App tags and package tags never collide because the tag
names use different schemes:

| Artifact | Version source | Tag name | Example |
|---|---|---|---|
| Parasti app | `package.json` | `vX.Y.Z` | `v1.1.0` |
| parasti-mcp | `mcp/package.json` | `mcp-vX.Y.Z` | `mcp-v1.0.1` |

SemVer meaning for the package:

- **MAJOR** — a tool is removed or renamed, or an argument/output behavior
  changes in a way that breaks existing AI-client workflows
- **MINOR** — a new tool, or an optional argument/output field (additive)
- **PATCH** — fixes, docs, dependency bumps

A package release is a push of an `mcp-v*` tag:
[`.github/workflows/publish-mcp.yml`](.github/workflows/publish-mcp.yml)
verifies the tag matches `mcp/package.json`, builds, smoke-tests the stdio
handshake, and publishes to npm — no interactive 2FA involved. The re-tagging
rule above applies per-scheme: once a package version is **successfully
published**, its tag name is final — fix forward with the next PATCH. (During
the initial setup of this pipeline, tags were deleted and re-created before any
successful publish, which is why no published artifact ever changed.)

## Database migrations are numbered separately

Files in `migrations/` use their own sequential scheme (`0001_initial.sql`,
`0002_files.sql`, …) that never mentions app versions. Migration numbers only
guarantee apply order; the release notes of a version list which migrations it
contains. Deleting or renumbering an existing migration file is forbidden even
if the release hasn't shipped — add a new one instead.

## Release notes

Every release tag gets a short changelog entry: the version, the date, the
highlights, and — when migrations are included — the exact list of migration
files and whether each is additive or breaking. Users self-hosting on
Cloudflare should be able to upgrade from any previous version by reading only
the entries between their current version and the target.
