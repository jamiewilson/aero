import { defineConfig } from 'vite-plus/pack'

export default defineConfig({
	entry: ['src/index.ts', 'src/browser.ts', 'src/ide-catalog.ts'],
	format: ['esm'],
	dts: true,
	clean: true,
	outDir: 'dist',
})
