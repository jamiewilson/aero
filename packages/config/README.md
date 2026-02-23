# @aero-ssg/config

Typed Aero configuration and Vite config factory. Used by `aero.config.ts` and the dev/build entry to produce the final Vite config (Aero plugin, optional content plugin, and user overrides).

## Exports

| Export | Description |
|--------|-------------|
| `defineConfig(config)` | Typed helper for `aero.config.ts`. Accepts a static `AeroConfig` or `AeroConfigFunction`. Returns the config unchanged (for IDE/type inference). |
| `createViteConfig(aeroConfig, options)` | Builds the Vite `UserConfig` from Aero config and env (`command`, `mode`). Merges defaults, Aero + content plugins, and user `vite`; preserves base `minify`/`cssMinify` when user sets them. |
| `AeroConfig`, `AeroConfigFunction`, `AeroUserConfig` | TypeScript types for config shape and env-aware function. |

## Config shape (`AeroConfig`)

| Field | Type | Description |
|-------|------|-------------|
| `content` | `boolean \| AeroContentOptions` | Enable content collections. `true` or options (e.g. `config` path). |
| `server` | `boolean` | Enable Nitro server integration (default: `false`). |
| `site` | `string` | Canonical site URL (e.g. `'https://example.com'`). Exposed as `import.meta.env.SITE` and `Aero.site` in templates; used for sitemap, RSS, canonical links. |
| `dirs` | `object` | Overrides: `client`, `serverDir`, `dist`. |
| `vite` | `UserConfig` | Vite config merged with Aero defaults. |

## Usage

**aero.config.ts**

```ts
import { defineConfig } from '@aero-ssg/config'

export default defineConfig({
	content: true,
	server: true,
	site: 'https://example.com', // optional; for sitemap, RSS, canonical URLs
	dirs: { client: 'client', dist: 'dist' },
	vite: { build: { target: 'esnext' } },
})
```

**Config as a function (env-aware)**

```ts
import { defineConfig } from '@aero-ssg/config'

export default defineConfig(({ command, mode }) => ({
	content: true,
	server: mode === 'production',
	vite: command === 'build' ? { build: { minify: true } } : {},
}))
```

**vite.config.ts (build entry)**

```ts
import { createViteConfig } from '@aero-ssg/config'
import aeroConfig from './aero.config'

export default createViteConfig(aeroConfig, {
	command: process.argv.includes('build') ? 'build' : 'dev',
	mode: (process.env.NODE_ENV as 'development' | 'production') || 'development',
})
```

## Defaults

`createViteConfig` uses a base Vite config from the package: PostCSS (autoprefixer), `build.cssMinify: 'esbuild'`, and rolldown `checks.eval: false`. The Aero plugin (`aero()`) from `@aero-ssg/core/vite` is always included; the content plugin (`aeroContent()`) from `@aero-ssg/content/vite` is added when `content` is enabled.

## Peer dependencies

- `vite` ^8.0.0  
- `@aero-ssg/core` (workspace)  
- `@aero-ssg/content` (workspace)
