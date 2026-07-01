import { defineHandler } from 'nitro/h3'

export default defineHandler(() => {
	const stamp = new Date().toISOString()
	return `<div id="oob-primary" class="card">
	Primary target refreshed at <code>${stamp}</code>
</div>
<div id="oob-status" data-aero-oob="outerHTML" class="card">
	Status (OOB): updated at <code>${stamp}</code>
</div>`
})
