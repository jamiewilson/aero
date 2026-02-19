import { aero } from '@aero-ssg/core/vite'
import { aeroContent } from '@aero-ssg/content/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [aero({ nitro: true }), aeroContent()],
	build: {
		cssMinify: 'esbuild',
		rolldownOptions: {
			checks: {
				eval: false,
			},
		},
	},
})
