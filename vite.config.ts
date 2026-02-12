import { aero } from 'aero/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: aero({ nitro: true }),
})
