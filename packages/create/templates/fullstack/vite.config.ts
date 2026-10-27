import { aero } from '@aero-js/core/vite'
import { applyAeroViteEnvFromVite } from '@aero-js/core/vite-config'
import { defineConfig } from 'vite-plus'

export default defineConfig(viteEnv => {
	applyAeroViteEnvFromVite(viteEnv)
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
