# Markflare landing page

The marketing site for [Markflare](https://github.com/Chaska-dev/Markflare), built with
[Astro](https://astro.build). Spanish lives at `/`, English at `/en`.

This is the orphan `landing` branch: it shares no history with `main`, so the app's
`git clone` and **Download ZIP** never carry the site.

## Commands

```bash
pnpm install
pnpm run dev       # http://localhost:4321
pnpm run build     # static output in dist/
pnpm run preview   # serve dist/
```

## Deploying on Cloudflare Pages

Create a Pages project connected to this repository with:

- **Production branch**: `landing`
- **Build command**: `pnpm run build`
- **Build output directory**: `dist`

## Where things are

| Path | What |
|---|---|
| `src/i18n.ts` | Every string on the page, in both languages |
| `src/components/` | One component per section, plus `Plate`, `CopyCommand`, `Pictogram` |
| `src/styles/global.css` | Tokens and the shared grammar (rules, buttons, the fuse) |
| `public/screenshots/{es,en}/` | Real captures of the app, one set per language |
| `PRODUCT.md`, `DESIGN.md` | Product facts and the visual system the page follows |

Copy changes go in `src/i18n.ts` only; both pages render the same components from it.
Deep reference material (SQL, API routes, configuration) stays in the app's README and
is linked from the page rather than duplicated here.
