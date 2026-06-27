import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: [
			'src/**/*.{test,spec}.{ts,js}',
			'__tests__/**/*.{test,spec}.{ts,js}',
		],
		environment: 'happy-dom',
	},
})
