import { defineHandler } from 'nitro/h3'

export default defineHandler(() => {
	const stamp = new Date().toISOString()
	return `<div id="oob-primary" class="card text-sm bg-green-500/10">
	Primary target refreshed at <code>${stamp}</code>
</div>
<div id="oob-status" data-aero-oob="outerHTML" class="card text-sm bg-green-500/10">
	Status (OOB): updated at <code>${stamp}</code>
</div>`
})
