import { defineConfig } from 'vite-plus/pack'

export default defineConfig({
	entry: {
		extension: 'src/extension.ts',
		server: '../language-server/src/index.ts',
	},
	format: ['cjs'],
	outDir: 'dist',
	deps: {
		// tsdown <0.23 compatibility: resolve external dependency subpaths.
		// Remove to preserve subpath imports as written (the new default).
		// https://tsdown.dev/options/dependencies#deps-resolvedepsubpath
		resolveDepSubpath: true,
		neverBundle: ['vscode'],
		onlyBundle: false,
	},
	inputOptions: {
		checks: {
			eval: false,
		},
		resolve: {
			mainFields: ['module', 'main'],
		},
	},
})
