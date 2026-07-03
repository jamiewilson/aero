import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const repoRoot = path.dirname(fileURLToPath(import.meta.url))

/** Shared Vitest config for workspace packages (`pnpm --filter … test`). */
export default defineConfig({
	resolve: {
		alias: {
			'@aero-js/diagnostics/parity': path.join(
				repoRoot,
				'packages/diagnostics/src/__tests__/fixtures/parity/index.ts'
			),
		},
	},
	test: {
		include: [
			'src/**/*.{test,spec}.{ts,js}',
			'__tests__/**/*.{test,spec}.{ts,js}',
		],
	},
})
