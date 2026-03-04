import { defineConfig } from 'tsdown'

const entry = [
	'src/entry-dev.ts',
	'src/entry-prod.ts',
	'src/entry-editor.ts',
	'src/types.ts',
	'src/vite/index.ts',
	'src/utils/aliases.ts',
	'src/utils/redirects.ts',
	'src/runtime/index.ts',
	'src/runtime/instance.ts',
]

export default defineConfig({
	entry,
	format: ['esm'],
	dts: true,
	clean: true,
	outDir: 'dist',
	deps: {
		neverBundle: ['@content/site'],
	},
})
