import type { UserConfig } from 'vite'
import autoprefixer from 'autoprefixer'

export const defaultViteConfig: UserConfig = {
	css: {
		postcss: {
			plugins: [autoprefixer()],
		},
	},
	build: {
		cssMinify: false,
		rolldownOptions: {
			checks: {
				eval: false,
			},
		},
	},
}
