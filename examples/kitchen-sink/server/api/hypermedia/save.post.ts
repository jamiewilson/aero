import { defineHandler } from 'nitro/h3'

export default defineHandler(async () => {
	await new Promise(resolve => setTimeout(resolve, 300))
	return `<div class="card text-sm bg-green-500/10">Saved successfully</div>`
})
