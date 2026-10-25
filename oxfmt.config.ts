import type { UserConfig } from 'vite-plus'

/** Oxfmt settings (imported into vite.config.ts — no top-level fmt block comments). */
const config = {
	arrowParens: 'avoid',
	bracketSameLine: true,
	bracketSpacing: true,
	printWidth: 100,
	semi: false,
	singleAttributePerLine: false,
	singleQuote: true,
	tabWidth: 2,
	trailingComma: 'es5',
	useTabs: true,
	sortPackageJson: false,
	ignorePatterns: [
		'node_modules',
		'dist',
		'build',
		'.output',
		'.aero',
		'coverage',
		'.cursor',
		'.gemini',
		'.agent',
		'pnpm-lock.yaml',
		'**/dist/**',
		'**/.output/**',
		'**/.aero/**',
		'**/*.html',
		'**/*.htm',
		'**/generated-assets.ts',
	],
} satisfies NonNullable<UserConfig['fmt']>

export default config
