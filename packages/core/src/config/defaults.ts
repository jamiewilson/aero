/**
 * Default Vite configuration used as the base in createViteConfig.
 *
 * @remarks
 * Uses `build.cssMinify: 'esbuild'` and rolldown eval check.
 * `cssMinify: 'esbuild'` is used because Vite 8's default lightningcss has issues with some CSS
 * (e.g. `light-dark()`, `@function`); can be reverted when Vite adopts lightningcss v1.31.1+.
 * `css.devSourcemap: true` so `@tailwindcss/vite` passes compile `from` and nested `@import`
 * syntax errors retain the original CSS file/line (not the html-proxy page id).
 * PostCSS/autoprefixer can be added in the app if needed.
 */
import type { UserConfig } from 'vite'

export const defaultViteConfig: UserConfig = {
	// Tailwind's Vite plugin only passes compile `from` (and thus nested @import
	// file/line on CssSyntaxError) when CSS sourcemaps are enabled in serve.
	css: {
		devSourcemap: true,
	},
	build: {
		cssMinify: 'esbuild',
		rolldownOptions: {
			checks: {
				eval: false,
			},
		},
	},
}
