import fmt from './oxfmt.config'

import { defineConfig } from 'vite-plus'

const TEST_INCLUDE = ['src/**/*.{test,spec}.{ts,js}', '__tests__/**/*.{test,spec}.{ts,js}'] as const

type PackageTestProject = {
	name: string
	dir: string
	environment?: 'happy-dom'
}

const PACKAGE_PROJECTS: PackageTestProject[] = [
	{ name: '@aero-js/cli', dir: 'packages/cli' },
	{ name: '@aero-js/compiler', dir: 'packages/compiler' },
	{ name: '@aero-js/content', dir: 'packages/content' },
	{ name: '@aero-js/core', dir: 'packages/core' },
	{ name: '@aero-js/create', dir: 'packages/create' },
	{ name: '@aero-js/diagnostics', dir: 'packages/diagnostics' },
	{ name: '@aero-js/highlight', dir: 'packages/highlight' },
	{ name: '@aero-js/html-parser', dir: 'packages/html-parser' },
	{ name: '@aero-js/hypermedia', dir: 'packages/hypermedia', environment: 'happy-dom' },
	{ name: '@aero-js/interpolation', dir: 'packages/interpolation' },
	{ name: '@aero-js/language-server', dir: 'packages/language-server' },
	{ name: '@aero-js/prettier-plugin-aero', dir: 'packages/prettier-plugin-aero' },
	{ name: '@aero-js/reactivity', dir: 'packages/reactivity', environment: 'happy-dom' },
	{ name: 'aero-vscode', dir: 'packages/vscode' },
]

const BUILD_PACKAGES = [
	'@aero-js/interpolation',
	'@aero-js/html-parser',
	'@aero-js/highlight',
	'@aero-js/diagnostics',
	'@aero-js/compiler',
	'@aero-js/prettier-plugin-aero',
	'@aero-js/reactivity',
	'@aero-js/hypermedia',
	'@aero-js/core',
	'@aero-js/content',
	'@aero-js/cli',
] as const

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
			...PACKAGE_PROJECTS.map(({ name, dir, environment }) => ({
				test: {
					name,
					root: `./${dir}`,
					include: [...TEST_INCLUDE],
					...(environment ? { environment } : {}),
					...(name === '@aero-js/html-parser' ? { passWithNoTests: true } : {}),
				},
			})),
			{
				test: {
					name: 'scripts',
					include: ['scripts/**/*.test.{ts,js}'],
				},
			},
		],
	},
	run: {
		tasks: {
			'build:packages': {
				command: BUILD_PACKAGES.map(name => `pnpm --filter ${name} run build`),
				cache: {
					input: [
						{ auto: true },
						{ pattern: 'packages/*/tsdown.config.ts', base: 'workspace' },
						{ pattern: 'packages/*/vite.config.ts', base: 'workspace' },
					],
					output: [{ pattern: 'packages/*/dist/**', base: 'workspace' }],
				},
			},
		},
	},
	fmt,
})
