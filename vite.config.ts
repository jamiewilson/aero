import fmtConfig from './.oxfmtrc.json' with { type: 'json' }
import { defineConfig, type UserConfig } from 'vite-plus'

const fmt = fmtConfig as NonNullable<UserConfig['fmt']>
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
			'build:all': {
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
			'build:vscode': {
				command: 'pnpm --dir packages/vscode run build',
				dependsOn: ['build:all'],
				cache: {
					input: [
						{ pattern: 'packages/vscode/**', base: 'workspace' },
						{ pattern: 'packages/compiler/dist/**', base: 'workspace' },
					],
					output: [{ pattern: 'packages/vscode/dist/**', base: 'workspace' }],
				},
			},
			'build:website': {
				command: 'pnpm --dir website exec vp build',
				dependsOn: ['build:all'],
				cache: {
					input: [
						{ pattern: 'website/**', base: 'workspace' },
						{ pattern: 'packages/*/dist/**', base: 'workspace' },
					],
					output: [{ pattern: 'website/dist/**', base: 'workspace' }],
				},
			},
			'build:kitchen-sink:ci': {
				command: 'pnpm --dir examples/kitchen-sink exec vp build --mode ci',
				dependsOn: ['build:all'],
				cache: {
					input: [
						{ pattern: 'examples/kitchen-sink/**', base: 'workspace' },
						{ pattern: 'packages/*/dist/**', base: 'workspace' },
					],
					output: [
						{ pattern: 'examples/kitchen-sink/dist/**', base: 'workspace' },
						{ pattern: 'examples/kitchen-sink/.aero/**', base: 'workspace' },
					],
				},
			},
			'pack:vscode': {
				command: 'pnpm --dir packages/vscode exec vsce package --no-dependencies',
				dependsOn: ['build:vscode'],
				cache: {
					output: [{ pattern: 'packages/vscode/*.vsix', base: 'workspace' }],
				},
			},
			'build:workspace': {
				command: 'node -e "console.log(\'build:workspace ok\')"',
				dependsOn: ['build:all', 'build:website', 'build:kitchen-sink:ci'],
			},
			'check:all': {
				command: ['pnpm check', 'vp test run', 'pnpm test:e2e:ci'],
			},
			'release:prep': {
				command: ['vp test run', 'pnpm clean:all', 'pnpm install', 'vp run build:all'],
			},
		},
	},
	fmt,
})
