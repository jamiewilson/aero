import aeroConfig from './aero.config.ts'
import { createViteConfig } from '@aero-js/core/vite-config'
import { defineConfig, mergeConfig } from 'vite-plus'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(viteEnv =>
	mergeConfig(createViteConfig(aeroConfig, viteEnv), {
		plugins: [tailwindcss({ optimize: false })],
		build: { minify: false },
	})
)
