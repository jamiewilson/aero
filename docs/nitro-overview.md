## Nitro in Aero

Aero stays **static-first**. When you enable `server: true`, Nitro becomes the optional server layer around Aero's built HTML, APIs, middleware, storage, cache, database, tasks, and deployment presets.

The contract is intentionally thin:

- Aero owns page compilation and writes static HTML to `dist/` (or your configured output directory).
- Nitro owns request-time server behavior.
- End-user projects configure Nitro with a normal **`nitro.config.ts`** at the project root.
- End-user projects use Nitro-native files and APIs such as `server/api`, `server/routes`, `server/middleware`, `plugins`, `tasks`, `server.ts`, `useStorage`, `useDatabase`, `defineCachedHandler`, and `runTask`.

## Quick Start

Enable Nitro in your Aero config:

```ts
// aero.config.ts
import { defineConfig } from '@aero-js/config'

export default defineConfig({
	server: true,
})
```

Then configure Nitro in the project root:

```ts
// nitro.config.ts
import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
	runtimeConfig: {
		appName: 'My Aero App',
	},
	routeRules: {
		'/api/cache/**': { swr: 60 },
	},
})
```

### Preview: static site vs Nitro server

After a production build, choose how you preview:

| Command                                                                      | What runs                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm preview` (typically `AERO_SERVER=false vite build && vite preview`)    | Static files only — no Nitro APIs                                                    |
| `pnpm preview:api` (typically `vite build && node .output/server/index.mjs`) | Full Nitro server from `.output/`, including `server/api`, middleware, storage, etc. |

The **`@aero-js/starter-fullstack`** template (`packages/starters/fullstack` in the Aero repo) ships both scripts and a working `server/` tree you can copy from.

## Cookbook index

This page is the **Nitro-in-Aero cookbook**: short, copy-paste patterns for common server features. Jump to a topic:

- [Routing and handlers](#routing-and-handlers)
- [KV storage](#kv-storage)
- [Cache](#cache)
- [Database](#database)
- [Plugins, tasks, and server entry](#plugins-tasks-and-server-entry)
- [Route rules and runtime config](#route-rules-and-runtime-config)
- [Deployment presets](#deployment-presets)

For a **full runnable project** that exercises these patterns together, use the monorepo’s `packages/starters/fullstack` package (`pnpm create` / starter selection when available) or clone the repo and run `pnpm install && pnpm dev` inside that starter.

### Starter parity map (current)

The fullstack starter includes concrete files for the cookbook patterns in this doc:

- `server/api/hello.ts` — basic Nitro handler
- `server/api/kv/[key].ts` + `[key].post.ts` — KV storage example
- `server/api/cache/time.ts` — cached handler example
- `server/api/database/users.ts` — database example
- `plugins/runtime.ts` — Nitro plugin hook example
- `tasks/cache/warm.ts` + `server/api/tasks/cache-warm.post.ts` — Nitro tasks example
- `server.ts` — server entry example
- `nitro.config.ts` — canonical Nitro config

## What Aero Adds

Aero generates a small `.aero/nitro.config.mjs` during build, but that generated file now **extends your root `nitro.config.ts`** instead of replacing it.

Aero only injects the parts it must own:

- `rootDir`
- `output.dir`
- `scanDirs`
- `replace` values for `process.env.AERO_DIST` and `process.env.AERO_API_PREFIX`
- redirect-derived `routeRules`
- `noPublicDir: true` so Nitro serves the Aero-built `dist/` through your catch-all route

If both Aero redirects and your Nitro config define the same route rule path, Aero skips its redirect-derived rule and keeps the explicit Nitro rule.

## Nitro Filesystem Conventions

Use Nitro's normal project structure in Aero projects:

```text
.
├── client/
├── content/
├── server/
│   ├── api/
│   ├── routes/
│   └── middleware/
├── plugins/
├── tasks/
├── assets/
├── server.ts
├── aero.config.ts
├── nitro.config.ts
└── vite.config.ts
```

- `server/api` and `server/routes` remain the primary place for request handlers.
- `server/middleware` is for Nitro middleware, not Aero dev-only middleware.
- `plugins/`, `tasks/`, `assets/`, and `server.ts` are Nitro-native extension points at the project root.

## Supported Nitro Features

These Nitro config/features are intentionally supported in Aero through native Nitro config and APIs:

- `runtimeConfig`
- `routeRules`
- `storage` and `devStorage`
- cache APIs and cache route rules
- `experimental.database`, `database`, `devDatabase`
- `plugins`
- `modules`
- `tasks`, `scheduledTasks`
- `serverEntry`
- `serverAssets`
- `preset`
- `compatibilityDate`
- `openAPI`
- `features.websocket`
- `errorHandler`
- `imports`
- `alias`
- `devProxy`

These runtime APIs are supported as Nitro-native APIs, not Aero wrappers:

- `useStorage`
- `useDatabase`
- `defineCachedHandler`
- `defineCachedFunction`
- Nitro middleware
- Nitro plugins
- Nitro tasks
- Nitro server entry

## Routing and Handlers

Nitro file-based routing works the same in Aero:

```ts
// server/api/users/[id].ts
import { createError, defineHandler, getRouterParam } from 'nitro/h3'

export default defineHandler(event => {
	const id = getRouterParam(event, 'id')

	if (!id) {
		throw createError({
			statusCode: 400,
			message: 'User ID is required',
		})
	}

	return { id, name: `User ${id}` }
})
```

Nitro middleware is request-time middleware that runs in production, unlike Aero's `middleware` config:

```ts
// server/middleware/auth.ts
import { defineHandler, getHeader } from 'nitro/h3'

export default defineHandler(event => {
	const token = getHeader(event, 'authorization')
	event.context.user = token ? { authenticated: true } : null
})
```

## KV Storage

Use Nitro's storage layer directly:

```ts
// server/api/kv/[key].ts
import { defineHandler, getRouterParam } from 'nitro/h3'
import { useStorage } from 'nitro/storage'

export default defineHandler(async event => {
	const key = getRouterParam(event, 'key')
	const storage = useStorage('data')

	return {
		key,
		value: key ? await storage.getItem(key) : null,
	}
})
```

```ts
// nitro.config.ts
import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
	storage: {
		data: {
			driver: 'fs',
			base: './.data/kv',
		},
	},
	devStorage: {
		cache: {
			driver: 'fs',
			base: './.data/cache',
		},
	},
})
```

## Cache

Use Nitro's cache APIs or route rules:

```ts
// server/api/cache/time.ts
import { defineCachedHandler } from 'nitro/cache'

export default defineCachedHandler(
	() => ({
		now: new Date().toISOString(),
	}),
	{
		maxAge: 60,
		name: 'time',
	}
)
```

```ts
// server/api/cache/summary.ts
import { defineCachedFunction } from 'nitro/cache'
import { defineHandler } from 'nitro/h3'

const cachedSummary = defineCachedFunction(
	async (section: string) => ({
		section,
		generatedAt: new Date().toISOString(),
	}),
	{
		maxAge: 60,
		name: 'summary',
		getKey: section => section,
	}
)

export default defineHandler(async () => cachedSummary('docs'))
```

```ts
// nitro.config.ts
import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
	routeRules: {
		'/api/cache/**': { swr: 60 },
	},
})
```

## Database

Nitro's built-in SQL layer is available when you enable the experimental database feature:

```ts
// nitro.config.ts
import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
	experimental: {
		database: true,
	},
	database: {
		default: {
			connector: 'sqlite',
			options: { name: 'db' },
		},
	},
	devDatabase: {
		default: {
			connector: 'sqlite',
			options: { name: 'db-dev' },
		},
	},
})
```

```ts
// server/api/users/index.ts
import { defineHandler } from 'nitro/h3'
import { useDatabase } from 'nitro/database'

export default defineHandler(async () => {
	const db = useDatabase()

	await db.sql`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			email TEXT UNIQUE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`

	const { rows } = await db.sql`SELECT * FROM users ORDER BY created_at DESC`
	return rows
})
```

## Plugins, Tasks, and Server Entry

Plugins use Nitro lifecycle hooks:

```ts
// plugins/runtime.ts
import { definePlugin } from 'nitro'

export default definePlugin(nitroApp => {
	nitroApp.hooks.hook('response', response => {
		response.headers.set('x-aero-nitro', 'true')
	})
})
```

Tasks stay Nitro-native:

```ts
// tasks/cache/warm.ts
import { defineTask } from 'nitro/task'

export default defineTask({
	meta: {
		description: 'Warm the demo cache',
	},
	run() {
		return {
			result: { warmedAt: new Date().toISOString() },
		}
	},
})
```

```ts
// server/api/tasks/cache-warm.post.ts
import { defineHandler } from 'nitro/h3'
import { runTask } from 'nitro/task'

export default defineHandler(async () => {
	const { result } = await runTask('cache:warm')
	return { result }
})
```

Server entry works the same way as normal Nitro:

```ts
// server.ts
export default {
	async fetch(request: Request) {
		const url = new URL(request.url)

		if (url.pathname === '/health') {
			return new Response('ok', {
				headers: { 'content-type': 'text/plain' },
			})
		}
	},
}
```

## Route Rules and Runtime Config

Use Nitro's route rules for cache headers, redirects, proxying, auth, or prerender flags:

```ts
// nitro.config.ts
import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
	runtimeConfig: {
		apiSecret: process.env.NITRO_API_SECRET,
	},
	routeRules: {
		'/api/**': { cors: true },
		'/docs/**': { headers: { 'cache-control': 'public, max-age=300' } },
		'/admin/**': { basicAuth: { username: 'admin', password: 'secret' } },
	},
})
```

## Deployment Presets

Nitro presets are configured normally:

```ts
// nitro.config.ts
import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
	preset: 'cloudflare_pages',
})
```

Document provider-specific behavior in Nitro terms. Aero should not add separate provider abstractions unless Aero itself needs provider-specific code.

## Constraints and Non-Primary Features

These Nitro capabilities are valid, but they are **not** Aero's primary path:

- Nitro renderer
- Nitro prerender for Aero page generation
- Nitro public-asset serving as the main asset pipeline

Why:

- Aero already compiles pages to static HTML during its Vite build.
- Aero's primary output is the Vite-built `dist/`.
- When `server: true` is enabled, Nitro should wrap that output, not replace Aero's page compiler.

Nitro prerender is still available for advanced cases, but it should not be presented as the default way to render Aero pages.

## Recommended Mental Model

- Use Aero for pages, layouts, components, content, and static generation.
- Use Nitro for APIs, middleware, storage, cache, database, hooks, tasks, and deployment targets.
- Configure Nitro in `nitro.config.ts`.
- Reach for raw Nitro APIs first; add Aero-level helpers only if repeated pain appears across multiple apps.
