import { defineHandler } from 'nitro/h3'

export default defineHandler(async () => {
	await new Promise(resolve => setTimeout(resolve, 300))
	return 'Saved successfully'
})
