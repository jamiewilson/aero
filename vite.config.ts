import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite-plus'

// Formatter options live in `.oxfmtrc.json`: a `fmt` block here makes `vp fmt` hand this file to oxfmt as config, which fails to parse it (vite-plus 0.1.14).
const workspaceRoot = dirname(fileURLToPath(import.meta.url))

/** In CI, disable Vite Task replay: it only caches terminal output, not dist/; a cache hit would skip real lint/test/build. Local dev keeps default task caching. */
const isCI = Boolean(process.env.CI && process.env.CI !== 'false' && process.env.CI !== '0')

export default defineConfig({
	root: workspaceRoot,
	test: {
		include: ['packages/**/*.test.{ts,js,mjs}'],
		pool: 'forks',
		teardownTimeout: 2000,
	},

	lint: {
		ignorePatterns: [
			'**/dist/**',
			'**/.output/**',
			'**/build/**',
			'packages/create/dist/**',
			'**/node_modules/**',
		],
	},

	run: {
		...(isCI ? { cache: false as const } : {}),
		tasks: {
			// Name must differ from root package.json `typecheck` script (vite-plus: task and script names cannot overlap).
			'typecheck:workspace': {
				command: 'pnpm -r typecheck',
			},
			// Ordered package chain (not fully implied by workspace:* deps). Each task is one `pnpm --filter … run build` so Vite+ Run can cache and schedule them separately.
			'build:pkg:interpolation': {
				command: 'pnpm --filter @aero-js/interpolation run build',
			},
			'build:pkg:highlight': {
				command: 'pnpm --filter @aero-js/highlight run build',
				dependsOn: ['build:pkg:interpolation'],
			},
			'build:pkg:diagnostics': {
				command: 'pnpm --filter @aero-js/diagnostics run build',
				dependsOn: ['build:pkg:highlight'],
			},
			'build:pkg:core': {
				command: 'pnpm --filter @aero-js/core run build',
				dependsOn: ['build:pkg:diagnostics'],
			},
			'build:pkg:vite': {
				command: 'pnpm --filter @aero-js/vite run build',
				dependsOn: ['build:pkg:core'],
			},
			'build:pkg:content': {
				command: 'pnpm --filter @aero-js/content run build',
				dependsOn: ['build:pkg:vite'],
			},
			'build:pkg:config': {
				command: 'pnpm --filter @aero-js/config run build',
				dependsOn: ['build:pkg:content'],
			},
			'build:pkg:cli': {
				command: 'pnpm --filter @aero-js/cli run build',
				dependsOn: ['build:pkg:config'],
			},
			// Meta-task: `@aero-js/create` has no `build` script (JS-only package); the old `pnpm -r --filter … run build` skipped it. Entry point for CI / `pnpm build`.
			'build:packages': {
				command: 'node -e "void 0"',
				dependsOn: ['build:pkg:cli'],
			},
		},
	},
})
