import { defineConfig } from 'vite-plus'

/** Shared Vitest config for workspace packages (`pnpm --filter … test`). */
export default defineConfig({
	test: {
		include: ['src/**/*.{test,spec}.{ts,js}', '__tests__/**/*.{test,spec}.{ts,js}'],
	},
})
