import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'happy-dom',
		include: [
			'src/**/*.{test,spec}.{ts,js}',
			'__tests__/**/*.{test,spec}.{ts,js}',
		],
	},
})
