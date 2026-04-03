# @aero-js/config

Typed Aero configuration and Vite config factory. Used by `aero.config.ts` and the dev/build entry to produce the final Vite config (Aero plugin, optional content plugin, and user overrides).

## Exports

### `@aero-js/config` (main)

| Export                                               | Description                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defineConfig(config)`                               | Typed helper for `aero.config.ts`. Accepts a static `AeroConfig` or `AeroConfigFunction`. Returns the config unchanged (for IDE/type inference).                                                                                                     |
| `loadAeroConfig(root)`                               | Loads `aero.config.ts` / `.js` / `.mjs` from `root` via jiti + the same path aliases as Vite (`jitiAliasRecordFromProject`). Returns `AeroConfig \| AeroConfigFunction \| null`. Used by **`@aero-js/cli`** **`aero check`** and optional fallbacks. |
| `redirectsToRouteRules`                              | Convert redirect entries for Nitro.                                                                                                                                                                                                                  |
| `AeroConfig`, `AeroConfigFunction`, `AeroUserConfig` | TypeScript types for config shape and env-aware function.                                                                                                                                                                                            |

### `@aero-js/config/vite`

Import **only** from `vite.config.ts` (pulls in Vite). Do **not** import this entry from `aero.config.ts` — jiti would load Vite in a CJS eval context and fail.

| Export                                  | Description                                                                                                                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createViteConfig(aeroConfig, options)` | Builds the Vite `UserConfig` from Aero config and env (`command`, `mode`). Merges defaults, Aero + content plugins, and user `vite`; preserves base `minify`/`cssMinify` when user sets them. |
| `getDefaultOptions()`                   | Derive `command` / `mode` from argv and `NODE_ENV`.                                                                                                                                           |

## Config shape (`AeroConfig`)

| Field     | Type                            | Description                                                                                                                                                             |
| --------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content` | `boolean \| AeroContentOptions` | Enable content collections. `true` or options (e.g. `config` path).                                                                                                     |
| `server`  | `boolean`                       | Enable Nitro server integration (default: `false`).                                                                                                                     |
| `site`    | `{ url: string }`               | Canonical site URL (e.g. `{ url: 'https://example.com' }`). Exposed as `import.meta.env.SITE` and `Aero.site.url` in templates; used for sitemap, RSS, canonical links. |
| `dirs`    | `object`                        | Overrides: `client`, `server`, `dist`. Same shape as the aero() Vite plugin.                                                                                            |
| `vite`        | `UserConfig`                    | Vite config merged with Aero defaults.                                                                                                                                  |
| `incremental` | `boolean`                       | When `true`, `vite build` sets `AERO_INCREMENTAL` if unset ([incremental static build](../../docs/build-performance.md)).                                               |

## Usage

**aero.config.ts**

```ts
import { defineConfig } from '@aero-js/config'

export default defineConfig({
	content: true,
	server: true,
	site: { url: 'https://example.com' }, // optional; for sitemap, RSS, canonical URLs
	dirs: { client: 'client', dist: 'dist' },
	vite: { build: { target: 'esnext' } },
})
```

**Config as a function (env-aware)**

```ts
import { defineConfig } from '@aero-js/config'

export default defineConfig(({ command, mode }) => ({
	content: true,
	server: mode === 'production',
	vite: command === 'build' ? { build: { minify: true } } : {},
}))
```

**vite.config.ts (build entry)**

```ts
import { createViteConfig } from '@aero-js/config/vite'
import aeroConfig from './aero.config.ts'

export default createViteConfig(aeroConfig, {
	command: process.argv.includes('build') ? 'build' : 'dev',
	mode: (process.env.NODE_ENV as 'development' | 'production') || 'development',
})
```

## Defaults

`createViteConfig` uses a base Vite config from the package: PostCSS (autoprefixer), `build.cssMinify: 'esbuild'`, and rolldown `checks.eval: false`. The Aero plugin (`aero()`) from `@aero-js/vite` is always included; the content plugin (`aeroContent()`) from `@aero-js/content/vite` is added when `content` is enabled.

## Peer dependencies

- `vite` ^8.0.0
- `@aero-js/core` (workspace)
- `@aero-js/content` (workspace)
