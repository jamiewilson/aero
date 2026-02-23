/**
 * Default Vite configuration used as the base in createViteConfig.
 *
 * @remarks
 * Includes PostCSS (autoprefixer), `build.cssMinify: 'esbuild'`, and rolldown eval check.
 * `cssMinify: 'esbuild'` is used because Vite 8's default lightningcss has issues with some CSS
 * (e.g. `light-dark()`, `@function`); can be reverted when Vite adopts lightningcss v1.31.1+.
 */
import type { UserConfig } from 'vite'
import autoprefixer from 'autoprefixer'

export const defaultViteConfig: UserConfig = {
	css: {
		postcss: {
			plugins: [autoprefixer()],
		},
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
