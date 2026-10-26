import { aero } from '@aero-js/core/vite'
import { applyAeroViteEnv } from '@aero-js/core/vite-config'
import { defineConfig } from 'vite-plus'

export default defineConfig(viteEnv => {
	applyAeroViteEnv(viteEnv.mode, viteEnv.envDir)
	return {
		plugins: [
			aero({
				server: true,
				site: {
					url: 'http://localhost:5173',
				},
			}),
		],
	}
})
