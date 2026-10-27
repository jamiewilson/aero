import { defineConfig } from 'vite-plus/pack'

export default defineConfig({
	entry: [
		'src/index.ts',
		'src/types.ts',
		'src/vite.ts',
		'src/markdown.ts',
		'src/render.ts',
		'src/processor.ts',
	],
	format: ['esm'],
	dts: true,
	clean: true,
	outDir: 'dist',
})
