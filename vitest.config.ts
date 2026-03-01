import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: [
			'packages/core/**/*.test.ts',
			'packages/content/**/*.test.ts',
			'packages/highlight/**/*.test.ts',
			'packages/interpolation/**/*.test.ts',
			'packages/aero-vscode/**/*.test.ts',
			'packages/create-aerobuilt/**/*.test.js',
		],
	},
})
