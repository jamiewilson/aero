import fmt from './oxfmt.config.mjs'

import { defineConfig } from 'vite-plus'

export default defineConfig({
	staged: {
		'*': 'vp check --fix',
	},
	lint: {
		ignorePatterns: [
			'**/node_modules/**',
			'**/dist/**',
			'**/build/**',
			'**/.output/**',
			'**/coverage/**',
			'.cursor/**/*',
			'.gemini/**/*',
			'.agent/**/*',
		],
		options: {
			typeAware: false,
			typeCheck: false,
		},
		jsPlugins: [
			{
				name: 'vite-plus',
				specifier: 'vite-plus/oxlint-plugin',
			},
		],
		rules: {
			'vite-plus/prefer-vite-plus-imports': 'error',
		},
	},
	test: {
		pool: 'forks',
		maxWorkers: 1,
		fileParallelism: false,
		teardownTimeout: 10_000,
		projects: [
			'packages/*',
			{
				test: {
					name: 'scripts',
					include: ['scripts/**/*.test.{ts,js}'],
				},
			},
		],
	},
	fmt,
})
