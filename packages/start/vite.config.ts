import { aero } from '@aero-ssg/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: aero({ nitro: true }),
})
