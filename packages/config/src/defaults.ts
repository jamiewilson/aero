import type { UserConfig } from 'vite'
import autoprefixer from 'autoprefixer'

/**
 * Aero's default Vite configuration.
 * These are opinionated defaults that may differ from Vite's defaults.
 *
 * Note: minify is set to 'esbuild' because Vite 8's default lightningcss
 * has compatibility issues with some CSS features. When Vite adopts
 * lightningcss v1.31.1+, this can be removed to use Vite's default.
 */
export const defaultViteConfig: UserConfig = {
	css: {
		postcss: {
			plugins: [autoprefixer()],
		},
	},
	build: {
		// Aero opinionated: use esbuild instead of Vite's default lightningcss
		// (lightningcss has light-dark and @function compatibility issues in Vite 8 beta)
		// TODO: Needs to handle cssMinify specifically for lightingcss but Aero looks for buld.minify
		// minify: 'esbuild',
		cssMinify: 'esbuild',
		rolldownOptions: {
			checks: {
				eval: false,
			},
		},
	},
}
