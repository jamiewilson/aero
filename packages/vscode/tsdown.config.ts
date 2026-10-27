import { defineConfig } from 'vite-plus/pack'

export default defineConfig({
	entry: {
		extension: 'src/extension.ts',
		server: '../language-server/src/index.ts',
	},
	format: ['cjs'],
	outDir: 'dist',
	deps: {
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
