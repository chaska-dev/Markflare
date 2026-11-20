// Entry Cloudflare Worker (static assets + API).
//
// Semua request masuk ke sini (`run_worker_first: true` di wrangler.jsonc):
// path /api/* diteruskan ke app Hono di functions/api/[[route]].ts, sisanya
// dilayani sebagai static assets (hasil `vite build` di dist/, dengan
// fallback SPA ke index.html untuk route React Router).
import app, { type AppEnv } from '../functions/api/[[route]].ts';

type Env = AppEnv['Bindings'] & { ASSETS: Fetcher };

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (/^\/api(\/|$)/.test(new URL(req.url).pathname)) {
      return app.fetch(req, env, ctx);
    }
    return env.ASSETS.fetch(req);
  },
};
