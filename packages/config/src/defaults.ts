import type { UserConfig } from 'vite'
import autoprefixer from 'autoprefixer'

/**
 * Aero's default Vite configuration.
 * These are opinionated defaults that may differ from Vite's defaults.
 *
 * Note: minify is set to 'esbuild' because Vite 8's default lightningcss
 * has issues with some CSS features like `light-dark()` and `@function`.
 * Can be removed when Vite adopts lightningcss v1.31.1+.
 */
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
