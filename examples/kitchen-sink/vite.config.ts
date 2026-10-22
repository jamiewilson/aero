import { createViteConfig } from '@aero-js/core/vite-config'
import aeroConfig from './aero.config.ts'
import tailwindcss from '@tailwindcss/vite'
import { mergeConfig } from 'vite-plus'

export default mergeConfig(createViteConfig(aeroConfig), {
	plugins: [tailwindcss()],
	build: { minify: false },
})
