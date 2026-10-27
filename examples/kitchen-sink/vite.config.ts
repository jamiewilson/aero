import {
	applyAeroViteEnvFromVite,
	createViteConfig,
	viteEnvToCreateViteConfigOptions,
} from '@aero-js/core/vite-config'
import aeroConfig from './aero.config.ts'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, mergeConfig } from 'vite-plus'

export default defineConfig(viteEnv => {
	applyAeroViteEnvFromVite(viteEnv)
	return mergeConfig(createViteConfig(aeroConfig, viteEnvToCreateViteConfigOptions(viteEnv)), {
		plugins: [tailwindcss()],
		build: { minify: false },
	})
})
