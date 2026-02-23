# Environment variables

Aero uses Vite’s environment variable system. Variables are available at build time and, when exposed, in client code via `import.meta.env`.

## Where variables run

- **Build-time only** — Any variable is available in `<script is:build>` and other code that runs during the build (e.g. in Node). Use this for API keys, feature flags, or config that must not reach the browser.
- **Client (browser)** — Only variables that are explicitly exposed are available in client scripts and inlined code. By default Vite exposes variables whose names start with **`VITE_`**. That keeps secrets out of the client bundle.

So: use **no prefix** (or a private convention) for server-only values, and **`VITE_`** for values that are safe to ship to the client.

## Convention

| Prefix   | Where it’s available        | Example use                    |
|----------|-----------------------------|--------------------------------|
| (none)   | Build / server only         | API keys, internal URLs        |
| `VITE_`  | Build and client            | Public API base URL, feature flags |

Example `.env`:

```bash
# Server/build only (never sent to the client)
API_SECRET=xxx
API_BASE=https://api.internal.example.com

# Exposed to the client (Vite default prefix)
VITE_PUBLIC_API=https://api.example.com
VITE_FEATURE_X=enabled
```

In code:

- In `<script is:build>` or any build-time code: `import.meta.env.API_SECRET`, `import.meta.env.VITE_PUBLIC_API`, etc.
- In client scripts: only `import.meta.env.VITE_*` (and built-ins like `MODE`, `DEV`, `PROD`) are replaced by Vite.

You can change the client prefix with Vite’s [envPrefix](https://vite.dev/config/shared-options.html#envprefix) (e.g. `envPrefix: 'PUBLIC_'` to use `PUBLIC_` instead of `VITE_`).

## Built-in and Aero-injected values

Vite provides:

- `import.meta.env.MODE` — `'development'` or `'production'`
- `import.meta.env.DEV` — `true` in dev
- `import.meta.env.PROD` — `true` in production build
- `import.meta.env.BASE_URL` — base URL from Vite config (e.g. `'./'`)
- `import.meta.env.SSR` — `true` when running in SSR/build

When you set **`site`** in your Aero config, the plugin injects:

- `import.meta.env.SITE` — your canonical site URL (e.g. `'https://example.com'`), or empty string if not set.

So in build scripts you can use `import.meta.env.SITE` without defining it in `.env`.

## .env files

Vite loads env files from the project root:

1. `.env` — all modes
2. `.env.local` — all modes, usually git-ignored
3. `.env.[mode]` — e.g. `.env.development`, `.env.production`
4. `.env.[mode].local` — mode-specific, usually git-ignored

Later files override earlier ones; existing shell environment variables win. Restart the dev server after changing `.env`.

## TypeScript (optional)

For type-checking and autocomplete on `import.meta.env`, add a declaration file (e.g. `env.d.ts` in the project root or under `client/`):

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly SITE: string
  // Add custom env vars (use VITE_ prefix for client-exposed):
  // readonly VITE_PUBLIC_API: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

Include this file in your `tsconfig.json` (e.g. via `include` or by placing it in a directory that is already included). The reference to `vite/client` pulls in Vite’s built-in env types; the interface extends them with `SITE` and any custom variables.
