/**
 * Default Vite configuration used as the base in createViteConfig.
 *
 * @remarks
 * Uses `build.cssMinify: 'esbuild'` and rolldown eval check.
 * `cssMinify: 'esbuild'` is used because Vite 8's default lightningcss has issues with some CSS
 * (e.g. `light-dark()`, `@function`); can be reverted when Vite adopts lightningcss v1.31.1+.
 * PostCSS/autoprefixer can be added in the app if needed.
 */
import type { UserConfig } from 'vite'

export const defaultViteConfig: UserConfig = {
	build: {
		cssMinify: 'esbuild',
		rolldownOptions: {
			checks: {
				eval: false,
			},
		},
	},
}
