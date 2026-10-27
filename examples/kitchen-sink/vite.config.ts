import { createViteConfig } from '@aero-js/core/vite-config'

import aeroConfig from './aero.config.ts'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, mergeConfig } from 'vite-plus'

export default defineConfig(viteEnv =>
	mergeConfig(createViteConfig(aeroConfig, viteEnv), {
		plugins: [tailwindcss({ optimize: false })],
		build: { minify: false },
	})
)
