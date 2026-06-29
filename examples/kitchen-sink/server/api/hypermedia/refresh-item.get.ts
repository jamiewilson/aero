import { defineHandler } from 'nitro/h3'

export default defineHandler(() => {
	const time = new Date().toLocaleTimeString()
	return `<li id="item-refresh" class="card">Refreshed at ${time}</li>`
})
