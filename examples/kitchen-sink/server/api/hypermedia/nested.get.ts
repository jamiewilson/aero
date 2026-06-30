import { defineHandler } from 'nitro/h3'

export default defineHandler(() => {
	return `<div id="nested-host" class="v-stack card">
	<p>Swapped fragment with <code>data-aero-on-click</code> processed after swap.</p>
	<button data-aero-on-click="{ GET('/api/hypermedia-demo', { target: '#nested-result' }) }">
		Nested load
	</button>
	<div id="nested-result" class="card">Nested target…</div>
</div>`
})
