import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: [
			'packages/config/**/*.test.ts',
			'packages/cli/**/*.test.ts',
			'packages/core/**/*.test.ts',
			'packages/diagnostics/**/*.test.ts',
			'packages/content/**/*.test.ts',
			'packages/highlight/**/*.test.ts',
			'packages/interpolation/**/*.test.ts',
			'packages/compiler/**/*.test.ts',
			'packages/vscode/**/*.test.ts',
			'packages/language-server/**/*.test.ts',
			'packages/create/**/*.test.js',
		],
	},
})
