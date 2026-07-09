import { defineHandler } from 'nitro/h3'

export default defineHandler(async () => {
	await new Promise(resolve => setTimeout(resolve, 300))
	return `<div id="nested-host" class="card grid gap-4">
	<p>Swapped fragment with <code>data-aero-on-click</code> processed after swap.</p>
	<button
		data-aero-on-click="{ GET('/api/hypermedia/fragment', {
		target: '#nested-result', autoDisable: true })}">
		Nested load
	</button>
	<div id="nested-result" class="card">Nested target…</div>
</div>`
})
