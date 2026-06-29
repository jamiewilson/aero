import { defineHandler } from 'nitro/h3'

export default defineHandler(async () => {
	await new Promise(resolve => setTimeout(resolve, 600))
	return '<p class="secondary">Saved successfully.</p>'
})
