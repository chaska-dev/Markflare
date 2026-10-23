# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers who want to self-host their own block-based notes workspace (a personal Notion)
on Cloudflare's free tier. They arrive from GitHub, a link, or a search, evaluate whether
the app is real and worth fifteen minutes of setup, and then deploy it.

## Product Purpose

Markflare is a self-hosted, single-user, block-based note-taking workspace that runs entirely
on Cloudflare: Pages serves the app and the API, D1 holds the notes, R2 holds uploads. The
landing page exists to make a self-hosting developer believe the app is real and finished,
and then get it deployed (clone / download, create D1 + R2, set three secrets).

Success: the visitor understands what Markflare is within seconds, sees the real app, and
leaves with the repo cloned or the deploy guide open.

## Positioning

A Notion-style editor you own outright, built on exactly three Cloudflare primitives
(Pages, D1, R2) with no server, no Docker, and no subscription. The local dev server is a
functional replica (Express + better-sqlite3 + `uploads/`) with the same routes. It also
ships an MCP server so AI assistants (Claude Desktop, Cursor, Zed) can read and write the
workspace.

## Operating Context

- Source: https://github.com/Chaska-dev/Markflare (MIT). ZIP: `/archive/refs/heads/main.zip`.
- Deploy: three methods in the README: 1. Cloudflare dashboard (recommended, ~15 min),
  2. Local only, 3. Terminal (`wrangler`). All end at `https://markflare.pages.dev`.
- Bindings: `DB` (D1 `markflare-db`), `BUCKET` (R2 `markflare-files`, private).
- Secrets: `AUTH_USERNAME`, `AUTH_PASSWORD`, `AUTH_SECRET` (`openssl rand -hex 32`).
- Package manager is pnpm everywhere; never `npm`.

## Capabilities and Constraints

- Block editor with `/` command menu: headings, lists, to-dos, code, math (KaTeX), tables,
  quotes, callouts, images, files, subpages.
- Nested pages with cascade delete; Trash with restore; favorites; covers; duplicate.
- Drag & drop blocks and nesting; drop files to upload.
- Public read-only share links: 128-bit tokens, revocable, scoped to the shared subtree.
- Markdown import and export.
- Uploads in R2 up to 25 MB, never in the database.
- MCP server (`pnpm run mcp`) with per-user API tokens.
- Bilingual UI (English / Spanish), light and dark themes.
- Single user. 24h HMAC-SHA256 bearer tokens; login rate-limited to 5/min/IP.
- The landing is a persuasive page plus a short deploy guide; full SQL, the API table and
  configuration detail live in the repository README and are linked, not duplicated.

## Brand Commitments

- Name: Markflare. Logo: `public/logo.svg` and `public/favicon.svg` (keep).
- Cloudflare orange `#F38020` is the brand accent and must remain.
- Bilingual site: Spanish at `/`, English at `/en`, with matching content.
- The landing lives on the orphan `landing` branch, separate from the app code on `main`.

## Evidence on Hand

- Real app screenshots, one set per language: `public/screenshots/{es,en}/app-tour.webp`,
  `app-arquitectura.webp`, `app-pendientes.webp`, `app-mobile.webp`.
- No users, testimonials, star counts, benchmarks or latency numbers exist. Do not invent
  them. No hosted public demo URL is confirmed.

## Product Principles

1. Show the real app; never a mockup presented as the product.
2. Ownership is the pitch: your Cloudflare account, your database, your bucket.
3. Exact over impressive: every command, binding name and limit is copy-paste correct.
4. Short path to running: the page shortens the deploy, the README completes it.
