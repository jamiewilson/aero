# Middleware and redirects

Aero supports two request-time mechanisms: **redirects** (dev + Nitro server) and **middleware** (dev only).

## Redirects (dev + server)

Use the **`redirects`** config for path → URL redirects that should work in **dev** and when using the **Nitro server** (preview:api and production). They are applied before rendering in dev and via Nitro `routeRules` when the server runs.

**aero.config.ts:**

```ts
import { defineConfig } from '@aero-ssg/config'

export default defineConfig({
  site: 'https://example.com',
  redirects: [
    { from: '/home', to: '/', status: 301 },
    { from: '/old-page', to: '/new-page', status: 302 },
  ],
  server: true,
})
```

- **Dev:** The Vite plugin applies these before rendering; a matching path gets a `Location` response and no page render.
- **Server (preview:api / production):** The plugin sets `AERO_REDIRECTS` before `nitro build`; the app's `nitro.config.ts` should merge them into `routeRules` (e.g. using `redirectsToRouteRules` from `@aero-ssg/config`). The start app's nitro.config is already set up for this.
- **Static build:** Redirects are not run at build time. For static-only deploys (no Nitro), use your host's redirect config (Netlify `_redirects`, Vercel `redirects`, etc.).
- **Matching:** Exact path only; `from` is compared to the request pathname. Add separate entries for `/path` and `/path/` if you need both.

## Middleware (dev only)

**Middleware** runs at request time in **dev** only. Use it for rewrites, custom responses, or logic that doesn't need to run in production. For redirects that must work in production with the server, use **`redirects`** above instead.

### When it runs

- **Dev (Vite):** Middleware runs in the Aero SSR middleware before `aero.render()`, after config `redirects` are checked.
- **Static build:** Middleware is **not** run during `pnpm run build`.
- **Production with Nitro:** The Nitro server does not run Vite or the Aero plugin, so **middleware does not run** in preview:api or production. Use `redirects` for redirects; use [Nitro middleware](https://nitro.build/guide/middleware) in `server/middleware.ts` for other request-time behavior.

### Static build behavior

During `pnpm run build`, the plugin discovers all pages and renders each once; no requests exist and neither redirects nor middleware run. For static-only deploys, configure redirects on your host.

## Configuration

**With `@aero-ssg/config` (aero.config.ts):**

```ts
import { defineConfig } from '@aero-ssg/config'
import type { AeroMiddleware } from '@aero-ssg/core/types'

// Option A: block body — use explicit `return` so all code paths return (satisfies noImplicitReturns)
const redirectHome: AeroMiddleware = (ctx) => {
  if (ctx.routePath === '/home') {
    return { redirect: { url: '/', status: 301 } }
  }
  return
}

// Option B: expression body — no "not all code paths return" warning
// const redirectHome: AeroMiddleware = (ctx) =>
//   ctx.routePath === '/home' ? { redirect: { url: '/', status: 301 } } : undefined

export default defineConfig({
  site: 'https://example.com',
  middleware: [redirectHome],
})
```

**With the Vite plugin directly:**

```ts
import { aero } from '@aero-ssg/core/vite'

function redirectOldPath(ctx) {
  if (ctx.routePath === '/old-page') {
    return { redirect: { url: '/new-page', status: 302 } }
  }
}

export default {
  plugins: [aero({ middleware: [redirectOldPath] })],
}
```

## Handler contract

Each middleware function receives a single argument:

- **`ctx`** — `AeroRequestContext`: `{ url, request, routePath, pageName, site }`
  - `url` — `URL` for the request
  - `request` — standard `Request`
  - `routePath` — pathname (e.g. `'/about'`, `'/blog/[id]'`)
  - `pageName` — resolved page key (e.g. `'about'`, `'blog/post'`)
  - `site` — canonical site URL from config (optional)

Return value (sync or Promise):

| Return | Effect |
|--------|--------|
| `undefined` / nothing | Continue to the next handler, then render as usual. |
| `{ redirect: { url: string, status?: number } }` | Respond with `Location` and status (default 302). Stop. |
| `{ rewrite: { pageName?: string, ...renderInput } }` | Render with the given page name and/or overridden `url`, `request`, `params`, `props`, etc. |
| `{ response: Response }` | Send the given `Response` (status, headers, body). Stop. |

Handlers run in order. The first `redirect` or `response` wins and no further handlers or render run. Multiple `rewrite` results are merged (later handlers override earlier).

## Examples

**Redirect with status:**

```ts
if (ctx.routePath === '/legacy') {
  return { redirect: { url: '/new-page', status: 301 } }
}
```

**Rewrite to a different page (e.g. A/B or feature flag):**

```ts
if (ctx.routePath === '/') {
  return { rewrite: { pageName: 'landing-v2' } }
}
```

**Custom response (e.g. 410 Gone):**

```ts
if (ctx.routePath === '/retired') {
  return {
    response: new Response('Gone', {
      status: 410,
      headers: { 'Content-Type': 'text/plain' },
    }),
  }
}
```

**Trailing-slash redirect (redirect `/about/` to `/about`):**

```ts
if (ctx.routePath !== '/' && ctx.routePath.endsWith('/')) {
  return { redirect: { url: ctx.routePath.replace(/\/$/, '') || '/', status: 301 } }
}
```

## Types

From `@aero-ssg/core/types`:

- `AeroRequestContext` — argument to each handler
- `AeroMiddlewareResult` — redirect / rewrite / response / void
- `AeroMiddleware` — `(ctx: AeroRequestContext) => AeroMiddlewareResult | Promise<AeroMiddlewareResult>`
