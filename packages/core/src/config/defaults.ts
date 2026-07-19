/**
 * Default Vite configuration used as the base in createViteConfig.
 *
 * @remarks
 * Uses rolldown eval check.
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
		rolldownOptions: {
			checks: {
				eval: false,
			},
		},
	},
}
