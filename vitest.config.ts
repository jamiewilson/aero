import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: [
			'packages/core/**/*.test.ts',
			'packages/content/**/*.test.ts',
			'packages/vscode/**/*.test.ts',
		],
	},
})
