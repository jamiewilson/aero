import { aero } from '@aero-ssg/core/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: aero({ nitro: true }),
})
