<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/logo-word-cream.svg" />
    <img src="public/logo-color.svg" alt="Parasti logo" width="220" />
  </picture>
  <h1>Parasti</h1>
</div>

<div align="center">

A self-hosted, block-based note-taking workspace that runs entirely on **Cloudflare**.

</div>

Pages with nested subpages, to-do lists, code blocks, tables, public share links, calendar
events, image and file uploads, and a bilingual interface (English / Spanish).

---

## What you get

- **Block editor** — type `/` for a command menu: headings, lists, to-dos, code, math,
  tables, quotes, callouts, images, files, subpages, web bookmarks and embeds (YouTube,
  Vimeo, Loom, Figma, Google Maps, CodePen, Spotify).
- **Nested pages** — a page can hold subpages, and deleting a page cascades to them.
- **Drag & drop** — move blocks around, nest them by dropping in the middle, and drop an
  image or document straight into the page to upload it.
- **Public share links** — one click to publish a page (and its subpages) read-only.
- **Calendar** — an events view with month and year navigation. An event is a date plus
  optional start/end times (`HH:MM`); events without times are all-day.
- **Markdown in and out** — import a `.md` file, export any page back to Markdown.
- **File storage in R2** — uploads up to 25 MB, never stored in the database.
- **MCP server** — connect AI assistants (Claude Desktop, Cursor, Zed) to your workspace.
- **Bilingual UI** — English and Spanish, switchable at runtime.

## Contents

| # | Section | What it covers |
|---|---------|----------------|
| 1 | [Stack](#stack) | What it's built with |
| 2 | [The three Cloudflare pieces](#the-three-cloudflare-pieces) | What you're actually creating |
| 3 | [Deploy](#deploy) | Production, staging, and local-only setup |
| 4 | [Run locally](#run-locally) | Develop on your machine |
| 5 | [File storage (R2)](#file-storage-r2) | Why uploads aren't in the database |
| 6 | [Database schema](#database-schema) | Every table, as copy-paste SQL |
| 7 | [API](#api) | All HTTP routes |
| 8 | [Configuration](#configuration) | Environment variables |
| 9 | [Model Context Protocol](#model-context-protocol-mcp) | AI assistant integration |
| 10 | [Notes](#notes) | Design decisions worth knowing |
| 11 | [Branching workflow](BRANCHING.md) | How the `dev`, `staging` and `main` branches work |

---

## Stack

| Layer | Production | Local dev |
|---|---|---|
| **Frontend** | React 18 + Vite 5 + TypeScript | same |
| **Backend** | Cloudflare Workers (Hono) | Express 5 |
| **Database** | Cloudflare D1 | `better-sqlite3` (SQLite file) |
| **File storage** | Cloudflare R2 | `uploads/` on disk |
| **AI / MCP** | Official Model Context Protocol server (`@modelcontextprotocol/sdk`) | same |

The local server is a functional replica: same routes, same request and response shapes,
so the frontend can't tell the difference.

---

## The three Cloudflare pieces

If this is your first time deploying to Cloudflare, this section is the one that matters.
You create three things, and they each have a job:

| What | Cloudflare service | Job in plain language | Created in |
|---|---|---|---|
| The website | **Workers** (with static assets) | Serves the app and runs the API. It's the "web host". | `wrangler.jsonc` + [step 1.6](#16-deploy) |
| Your notes | **D1** | A SQLite database. Holds pages, blocks, share links, and events. | [step 1.2](#12-create-the-database-and-the-bucket) |
| Your images | **R2** | Object storage, like a private folder of files. | [step 1.2](#12-create-the-database-and-the-bucket) |

Two of them are "bindings": you create them separately, then tell the Worker "this
variable is that database". The names are fixed and the code expects them:

| Binding variable | Points to | If it's missing |
|---|---|---|
| `DB` | your D1 database | nothing loads |
| `BUCKET` | your R2 bucket | uploads return `503` |

---

## Deploy

Parasti deploys as **one Cloudflare Worker**: the built frontend (`dist/`) is served
as static assets, and the same Worker runs the API (`worker/index.ts` → Hono) — one
origin, no separate Pages project. Everything is declared in `wrangler.jsonc`.

Two deployments are supported: **production** (`parasti`) and **staging**
(`parasti-staging`, via the `env.staging` block). Staging is an independent Worker
with its own D1 database, R2 bucket and secrets, so QA can never touch real notes.

**Jump to:** [1. Production](#1-production) · [2. Staging](#2-staging) ·
[3. Local only](#3-local-only-no-deploy)

---

### 1. Production

> **Time:** about 15 minutes. **Prerequisites:** a Cloudflare account, `node` +
> `pnpm`, and `pnpm install` already run in the repo.

#### 1.1. Log in and build

```bash
npx wrangler login     # opens the browser once
pnpm run build         # type-check + build to dist/
```

#### 1.2. Create the database and the bucket

Both can be created from the terminal:

```bash
npx wrangler d1 create parasti-db
npx wrangler r2 bucket create parasti-files
```

`d1 create` prints a **database_id** (a UUID) — copy it for the next step.

Prefer the dashboard? **Workers & Pages → D1 → Create database** (name `parasti-db`)
and **R2 → Create bucket** (name `parasti-files`) do the same thing.

> **Keep the bucket private.** Don't turn on the public `r2.dev` domain: uploads are
> served through the app (`/api/files/:id`), and a public bucket would bypass it.

#### 1.3. Point `wrangler.jsonc` at them

Open `wrangler.jsonc` and replace the placeholders:

```jsonc
"d1_databases": [
  { "binding": "DB", "database_name": "parasti-db", "database_id": "<the UUID>" }
],
"r2_buckets": [
  { "binding": "BUCKET", "bucket_name": "parasti-files" }
]
```

The binding names are fixed — the code expects `DB` and `BUCKET`. The file is safe to
commit: database ids and bucket names are identifiers, not secrets.

#### 1.4. Apply the schema

```bash
pnpm run db:migrate:prod
```

That is `wrangler d1 migrations apply parasti-db --remote`: every file in
`migrations/` is applied in order, tracked by name, so re-running is safe.

#### 1.5. Set the secrets

```bash
npx wrangler secret put AUTH_USERNAME
npx wrangler secret put AUTH_PASSWORD
npx wrangler secret put AUTH_SECRET    # generate with: openssl rand -hex 32
```

These are read only to **seed the first admin account** the first time the app
receives a request. After that, accounts live in the `users` table and passwords are
managed in the app (Account & Settings → Change Password / Manage Accounts).
Rotating `AUTH_SECRET` invalidates every issued token.

The same values can be set in the dashboard: **Workers & Pages → parasti →
Settings → Variables and secrets** (use the **Encrypt** type).

#### 1.6. Deploy

```bash
pnpm run deploy        # pnpm run build && wrangler deploy
```

Your app is live at `https://parasti.<your-subdomain>.workers.dev`.

**Custom domain (optional):** **Workers & Pages → parasti → Settings → Domains &
Routes → Add custom domain**. Cloudflare issues the certificate automatically.

#### 1.7. Verify

- Open the URL: the login page appears; sign in with `AUTH_USERNAME` / `AUTH_PASSWORD`.
- `curl -i https://<your-worker>/api/auth/me` returns `401` (the API is alive and guarded).
- Create a page, then create a second account under **Manage Accounts** and sign in
  with it — each account only sees its own pages.

---

### 2. Staging

Staging follows the branch flow in [BRANCHING.md](BRANCHING.md): `dev` → `staging` →
`main`. It is a separate Worker (`parasti-staging`) with its own database, bucket and
secrets, so it is safe to break. Use it for QA — including the PBKDF2 CPU-time check
before a production release.

`wrangler.jsonc` already contains the `env.staging` block. Fill it once:

```bash
npx wrangler d1 create parasti-staging-db     # copy the database_id
npx wrangler r2 bucket create parasti-staging-files
```

Then put the id in `wrangler.jsonc` under `env.staging.d1_databases[0].database_id`,
and apply the schema + secrets to staging:

```bash
pnpm run db:migrate:staging
npx wrangler secret put AUTH_USERNAME --env staging
npx wrangler secret put AUTH_PASSWORD --env staging
npx wrangler secret put AUTH_SECRET   --env staging
```

Deploy what is on the `staging` branch:

```bash
git switch staging
git merge dev            # package the QA build (see BRANCHING.md)
pnpm run deploy:staging  # build + wrangler deploy --env staging
```

The staging URL is `https://parasti-staging.<your-subdomain>.workers.dev`.

> Staging has its own empty database: the first request seeds its admin from the
> `AUTH_*` staging secrets. Never point staging at `parasti-db` — QA changes would hit
> production notes.

---

### 3. Local only (no deploy)

Use this to work on Parasti without putting anything on the internet. There is no
Cloudflare project, no D1, and no R2 — the local server uses a SQLite file and a
folder on disk.

```bash
git clone https://github.com/<your-user>/parasti.git
cd parasti
pnpm install
cp .env.example .dev.vars      # set AUTH_USERNAME, AUTH_PASSWORD, AUTH_SECRET
pnpm run db:migrate:all        # creates data/parasti.db with the schema
pnpm run dev                   # Express on :3000 + Vite on :5173
```

Open <http://localhost:5173> and sign in with the credentials in `.dev.vars`.

`wrangler dev` is the other local option: it runs the **real Worker runtime** with a
locally simulated D1 and R2 (no account or network needed), for checking the exact
production code path before deploying.

```bash
pnpm run build
npx wrangler dev
```

More detail in [Run locally](#run-locally).

---

## Run locally

The local stack mirrors production closely enough that you rarely need Cloudflare to work
on Parasti.

| Piece | Production | Local |
|---|---|---|
| Database | D1 | SQLite at `data/parasti.db` |
| Uploads | R2 bucket | `uploads/` on disk |
| API | Worker (Hono) | Express on `:3000` |

```bash
pnpm run dev          # both servers, with hot reload
pnpm run dev:server   # API only
pnpm run dev:web      # frontend only
```

| Script | What it does |
|---|---|
| `pnpm run dev` | Express + Vite together |
| `pnpm run build` | type-check and build to `dist/` |
| `pnpm run db:migrate:all` | apply migrations to the local SQLite file |
| `pnpm run db:migrate:local` | apply migrations to the local D1 used by `wrangler dev` |
| `pnpm run db:migrate:prod` | apply migrations to the remote production D1 |
| `pnpm run db:migrate:staging` | apply migrations to the remote staging D1 |
| `pnpm run preview` | serve the built `dist/` + API through `wrangler dev` |
| `pnpm run deploy` | build and deploy the Worker (production) |
| `pnpm run deploy:staging` | build and deploy the Worker to `env.staging` |
| `pnpm run mcp` | start the MCP server |
| `pnpm run mcp:token` | generate an API/MCP token from the CLI |
| `pnpm run test:mcp` | run the MCP test suite |

> **Upgrading from an older checkout?** Migration files are edited in place and tracked by
> name in `_migrations_applied`, so a database that was already migrated will **not** pick
> up schema changes. Delete `data/` and re-run `pnpm run db:migrate:all` to rebuild it.

---

## File storage (R2)

> Creating the bucket and binding it are covered in
> [step 1.2](#12-create-the-database-and-the-bucket). This section is the reasoning behind
> that split, and what to do if you're coming from an older version.

Images and attachments never go into the database. In production they land in an R2 bucket;
in local dev they land in `uploads/`. The `files` table keeps metadata only, plus a `storage`
column recording which backend owns the bytes. Uploads are capped at **25 MB**.

**Why not just use the database?** A D1 row tops out at 2 MB, and base64 inflates bytes by
a further ~33%, so the ceiling would be roughly a 1.5 MB image — and every note would
compete with those bytes for the same 500 MB on the free plan. Splitting them keeps D1 for
text, which is what it's good at, and lets the file bucket scale on its own.

**What it costs.** The free tier gives 10 GB-month of storage, 1M writes and 10M reads per
month, and bandwidth is never charged. Past that it's $0.015/GB-month, so a personal
workspace doesn't realistically leave $0.

**One rule worth knowing:** the bucket must stay private, and uploads go through
`/api/files/:id`. That route is intentionally unauthenticated so images inside public share
pages can load, which means the R2 bucket is the only thing standing between your uploads
and the open internet. Don't turn on `r2.dev`.

### Already deployed with an older version?

The old schema stored the file bytes in a `data TEXT` column, base64-encoded. Migration
files are edited in place, so the new shape only lands on a **fresh** database. If you
already have one, run this once in the D1 Console:

```sql
DROP TABLE IF EXISTS files;

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  storage TEXT NOT NULL DEFAULT 'r2',
  page_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_files_page ON files(page_id);
```

Images already embedded in your pages will 404 afterwards — their bytes went out with the
old table. Re-upload them.

---

## Database schema

All migrations live in `migrations/NNNN_*.sql`, run in filename order, each wrapped in a
transaction. They are idempotent, so re-running is safe.

| File | Adds |
|---|---|
| `0001_initial.sql` | `pages`, `blocks` (with `parent_id` + `collapsed`), indexes |
| `0002_files.sql` | `files` — metadata only; the bytes live in R2 |
| `0003_workspace.sql` | `workspace` singleton (sidebar name + icon) |
| `0004_shares.sql` | `page_shares` — public share tokens with a `revoked` tombstone |
| `0005_api_tokens.sql` | `api_tokens` — tokens for the MCP server and CLI integrations |
| `0006_page_features.sql` | `pages.deleted_at` (Trash), `is_favorite`, `full_width`, `is_project`, `cover` + index |
| `0007_block_props.sql` | `blocks.props` — JSON bag for per-block settings (image width / alignment / caption) |
| `0008_events.sql` | `events` — calendar events: a wall-clock date plus optional `start_time`/`end_time` (`HH:MM`; NULL = all-day), no timezone column on purpose |
| `0009_users.sql` | `users` — accounts (PBKDF2 hashes) + `owner_user_id` columns on `pages`/`events`/`files` and `user_id` on `api_tokens` (multi-user isolation) |

> **`0006` is required before deploying this version.** The API now filters on
> `pages.deleted_at`, so against a D1 that has not applied it every page request fails with
> "no such column". Run `pnpm run db:migrate:prod` first. The file is plain `ALTER TABLE`
> statements (SQLite cannot make those idempotent), so if you apply migrations by hand in the
> dashboard, run it exactly once. The local server self-heals a half-applied dev database
> (`healSchema()` in `server/db.ts`), so `pnpm run dev` needs no extra step.
>
> The same goes for `0007`: block create/update queries now read and write `blocks.props`,
> so run `pnpm run db:migrate:prod` before deploying.
>
> The same applies to `0008_events.sql`: the calendar reads and writes the `events` table,
> so a D1 without it makes every events request fail with "no such table". Unlike `0006`
> and `0007` it is a plain `CREATE TABLE IF NOT EXISTS`, so applying it by hand is safe to
> re-run.
>
> **`0009` is required before deploying this version.** The API authenticates against the
> `users` table and filters every data query by `owner_user_id` / `user_id`, so a D1
> without it makes login fail with "no such table" (and every list come back empty). On a
> fresh remote, `pnpm run db:migrate:prod` applies everything in order — including the
> legacy-data backfill, which assigns all pre-multi-user pages/events/files to the first
> admin on the next request.

To apply them to a remote D1 from a terminal:

```bash
pnpm run db:migrate:prod     # wrangler d1 migrations apply parasti-db --remote
```

To apply them by hand, paste the SQL files into the D1 **Console** in the dashboard —
but `pnpm run db:migrate:prod` (or `:staging`) is the tracked path and the one to
prefer.

> **D1 caveat** — SQLite has no `ADD COLUMN IF NOT EXISTS`, and D1 has no `DROP COLUMN`.
> Any future migration that changes a table's shape has to use the rebuild pattern: create
> `_<table>_new` with the new shape, `INSERT INTO _<table>_new SELECT ... FROM <table>`,
> `DROP TABLE <table>`, then `ALTER TABLE _<table>_new RENAME TO <table>` — the whole script
> in one transaction.

---

## API

Everything is mounted under `/api`. 🔒 routes need a bearer token from
`POST /api/auth/login`, stored in `localStorage` and sent as `Authorization: Bearer …`.
👑 routes are admin-only. Data routes are scoped to the signed-in account: another
user's page, block, event or token answers `404`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | — | Get a 24h bearer token (per account) |
| GET | `/api/auth/me` | 🔒 | Current account profile (`id`, `username`, `displayName`, `isAdmin`) |
| POST | `/api/auth/password` | 🔒 | Change your own password (`currentPassword`, `newPassword`) |
| GET | `/api/pages` | 🔒 | List all pages |
| POST | `/api/pages` | 🔒 | Create a page |
| POST | `/api/pages/import` | 🔒 | Create a page from markdown |
| GET | `/api/pages/:id` | 🔒 | Page + ordered blocks (404 if trashed, unless `?include_trashed=1`) |
| GET | `/api/pages/:id/export` | 🔒 | Export page as markdown |
| PUT | `/api/pages/:id` | 🔒 | Update page (`title`, `icon`, `parent_id`, `position`, `is_favorite`, `full_width`, `is_project`, `cover`) |
| GET | `/api/pages/trash` | 🔒 | Trashed pages whose parent is not trashed (also purges items older than 30 days) |
| DELETE | `/api/pages/trash` | 🔒 | Empty the trash (permanent) |
| DELETE | `/api/pages/:id` | 🔒 | Move page and descendants to Trash (soft delete) |
| DELETE | `/api/pages/:id/permanent` | 🔒 | Cascade delete page, descendants, blocks and their files |
| POST | `/api/pages/:id/restore` | 🔒 | Restore from Trash (to the root if its parent is still trashed) |
| POST | `/api/pages/:id/duplicate` | 🔒 | Copy a page and its blocks next to the original |
| GET | `/api/pages/:id/cascade-count` | 🔒 | How many pages/blocks a delete would remove |
| POST | `/api/pages/:id/blocks` | 🔒 | Create a block |
| PUT | `/api/blocks/:id` | 🔒 | Update a block (reparenting is cycle-safe) |
| DELETE | `/api/blocks/:id` | 🔒 | Delete a block, and its upload if nothing else references it |
| PUT | `/api/blocks/reorder` | 🔒 | Batch reorder blocks |
| POST | `/api/files/upload` | 🔒 | Upload a file (≤ 25 MB, multipart) |
| GET | `/api/files/:id` | — | Stream a file — public so share pages can render images |
| GET | `/api/workspace` | 🔒 | Get sidebar name + icon |
| PUT | `/api/workspace` | 🔒 | Update workspace |
| POST | `/api/pages/:id/share` | 🔒 | Activate a public share |
| GET | `/api/pages/:id/share` | 🔒 | Get the active share |
| DELETE | `/api/pages/:id/share` | 🔒 | Revoke a share |
| GET | `/api/share/:token` | — | Public tree for a share |
| GET | `/api/share/:token/page/:pageId` | — | Public page inside a share |
| GET | `/api/auth/tokens` | 🔒 | List your API/MCP tokens |
| POST | `/api/auth/token` | 🔒 | Create an API/MCP token |
| DELETE | `/api/auth/tokens/:id` | 🔒 | Revoke a token |
| GET | `/api/admin/users` | 🔒👑 | List accounts (no password material is ever returned) |
| POST | `/api/admin/users` | 🔒👑 | Create an account (`username`, `displayName?`, `password`, `isAdmin?`) |
| PATCH | `/api/admin/users/:id` | 🔒👑 | Update `displayName`, `isActive`, `isAdmin` (cannot lock yourself out) |
| POST | `/api/admin/users/:id/reset-password` | 🔒👑 | Reset another account's password |
| GET | `/api/search` | 🔒 | Search pages and blocks |
| GET | `/api/events` | 🔒 | List events, sorted by date (all-day first within a date); optional `?from=YYYY-MM-DD&to=YYYY-MM-DD` filters the range |
| POST | `/api/events` | 🔒 | Create an event (`title`, `event_date`, optional `start_time`/`end_time` as `HH:MM`; empty or null times = all day) |
| PUT | `/api/events/:id` | 🔒 | Update an event (404 if it doesn't exist) |
| DELETE | `/api/events/:id` | 🔒 | Delete an event |

`GET /api/files/:id` is unauthenticated on purpose: a shared page is viewable by anyone
with the link, and its embedded images have to load the same way. The R2 bucket stays
private — the Worker is what serves the bytes.

---

## Configuration

A template lives at `.env.example`. Copy it to `.dev.vars` and fill in real values;
`.dev.vars` is gitignored.

```bash
cp .env.example .dev.vars
```

| Variable | Required | Description |
|---|---|---|
| `AUTH_USERNAME` | yes | Username for the **first admin account** — it seeds the `users` table on the first request |
| `AUTH_PASSWORD` | yes | Password for that first admin — use a strong one |
| `AUTH_SECRET` | yes | Long random string for signing bearer tokens. Generate with `openssl rand -hex 32`. Rotating it **invalidates every token issued so far**, which is what you want if one ever leaks. |
| `PARASTI_DB_PATH` | no | Override the local SQLite path (default `./data/parasti.db`) |

**Local** — read from `.dev.vars` by both `wrangler dev` and the local Express server.

**Production** — set the same three `AUTH_*` values with `wrangler secret put` (see
[step 1.5](#15-set-the-secrets)), or in the dashboard under **Settings → Variables and
secrets** (**Encrypt** type). They are only used to seed the first admin; later accounts
and password changes live in the `users` table.

**Staging** — same commands with `--env staging` (see [2. Staging](#2-staging)).

---

## Model Context Protocol (MCP)

Parasti ships an MCP server, so AI assistants can read and write your workspace.
Requires the `api_tokens` table (migration `0005_api_tokens.sql`). Each account has its
own tokens, and a token only sees its owner's pages.

Generate a token from **Account & Settings → API / MCP Token** in the app, then:

```bash
pnpm run mcp        # start the MCP server on stdio
pnpm run test:mcp   # run the end-to-end test suite
```

It can import Markdown content and `.md` files into pages, list your pages and inspect the
hierarchy, and search pages and blocks.

Client configuration for Claude Desktop, Cursor and Zed is in
[`mcp/README.md`](mcp/README.md).

---

## Notes

- **Auth** — accounts are created by an admin; there is no self-registration. Passwords are
  PBKDF2-SHA256 (100,000 iterations, per-user salt and iteration count). 24h HMAC-SHA256
  bearer tokens, constant-time comparisons, login rate-limited to 5 attempts per minute per
  IP. Every data query is scoped to the owner; accessing someone else's item returns 404.
- **CORS** — same-origin only; the frontend and `/api` share a host.
- **Foreign keys** — `PRAGMA foreign_keys = ON` runs on every D1 request, because D1
  connections start with FKs off.
- **Public shares** — 128-bit tokens, regenerated on every re-activation. Visitor requests
  are scoped to the share's descendant tree, so a share can't be walked upwards.
- **Deleting pages** — cascading a page also removes its blocks, the files they referenced,
  and the R2 objects. An upload is only removed once no block points at it any more, so
  duplicated images don't break when you delete one copy.

---

## Tech choices

- **pnpm** — the package manager throughout (lockfile is `pnpm-lock.yaml`), for strict
  dependency resolution with no phantom deps, a content-addressable store that saves disk
  across projects, and faster installs. `pnpm.onlyBuiltDependencies` in `package.json`
  whitelists the few packages that need build scripts (`better-sqlite3`, `esbuild`,
  `sharp`, `workerd`). `package.json` declares `"packageManager": "pnpm@10.11.1"` so
  Corepack uses the same pnpm version everywhere. Every command in this README is
  `pnpm …` — never `npm …`.
- **`wrangler.jsonc` in the repo** — Worker config as code: static assets, D1, R2, and the
  `staging` environment. Database ids and bucket names are identifiers, not secrets, so the
  file is committed. See [Deploy](#deploy).

---

## Credits

Parasti is a fork of [Markflare](https://github.com/chaska-dev/Markflare) by
[chaska-dev](https://github.com/chaska-dev) (Josue Espinoza), released under the
MIT License. Credit for the original architecture, editor model, and Cloudflare
deployment design belongs to the upstream project — Parasti rebrands it, then
continues development on top of that base.

## License

[MIT](LICENSE).

- Markflare (upstream): Copyright (c) 2026 Josue Espinoza
- Parasti (this fork): Copyright (c) 2026 rokifran

The upstream copyright notice is retained in `LICENSE` as required by the MIT
License; the notice covers both the original work and this fork's changes.
