import { defineConfig } from 'vitest/config'

/** Local root so `pnpm test` from this package finds tests (repo root uses `packages/**`). */
export default defineConfig({
	test: {
		include: ['src/**/*.test.ts'],
	},
})
