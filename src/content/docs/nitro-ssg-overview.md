## Static Site Generation (SSG)

Use Nitro's prerendering to generate static HTML at build time, shipping only necessary JavaScript to the client—similar to Astro.

### Enable Prerendering

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { nitro } from 'nitro/vite'

export default defineConfig({
	plugins: [nitro()],
	nitro: {
		serverDir: './server',
		prerender: {
			// Routes to prerender
			routes: ['/', '/about', '/blog'],

			// Automatically crawl and prerender linked pages
			crawlLinks: true,

			// Fail build if prerendering fails
			failOnError: true,
		},
	},
})
```

### Prerender Configuration Options

```typescript
prerender: {
	// Explicit routes to prerender
	routes: ['/', '/about', '/contact'],

	// Crawl <a> tags and prerender discovered pages
	crawlLinks: true,

	// Ignore patterns (strings, regex, or functions)
	ignore: [
		'/api',           // Ignore all /api routes
		/^\/admin/,       // Ignore admin routes
		(route) => route.includes('private'),
	],

	// Control prerender speed (useful for rate-limited APIs)
	concurrency: 4,
	interval: 100, // ms between requests

	// Retry failed prerenders
	retry: 3,
	retryDelay: 500,

	// Output format
	autoSubfolderIndex: true, // /about -> /about/index.html
}
```

### Route Rules for Static Pages

Define caching and prerendering behavior per-route:

```typescript
// vite.config.ts
export default defineConfig({
	plugins: [nitro()],
	nitro: {
		serverDir: './server',
		routeRules: {
			// Prerender at build time (fully static)
			'/': { prerender: true },
			'/about': { prerender: true },
			'/blog/**': { prerender: true },

			// Static with revalidation (ISR-like)
			'/products/**': { swr: 3600 }, // Revalidate every hour

			// Never prerender (always server-rendered)
			'/api/**': { prerender: false },
			'/dashboard/**': { prerender: false },

			// Add caching headers
			'/assets/**': {
				headers: { 'cache-control': 'max-age=31536000, immutable' },
			},
		},
	},
})
```

### Environment-Specific Handlers

Create handlers that only run in specific environments:

```typescript
// server/routes/static-data.prerender.ts
// This handler ONLY runs during prerendering
import { defineHandler } from 'nitro/h3'

export default defineHandler(() => {
	return `
		<div>
			<h1>Static Content</h1>
			<p>Generated at: ${new Date().toISOString()}</p>
		</div>
	`
})
```

```typescript
// server/routes/admin.dev.ts
// This handler ONLY runs in development
import { defineHandler } from 'nitro/h3'

export default defineHandler(() => {
	return { debug: true, env: 'development' }
})
```
