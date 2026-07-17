import { defineHandler } from 'nitro/h3'

/** Intentional 4xx HTML fragment — still swapped into the target. */
export default defineHandler(event => {
	event.res.status = 422
	return `<div class="card text-sm bg-amber-500/10" role="alert">
		<strong>Validation failed</strong>
		<p class="mt-1 opacity-80">Intentional ${event.res.status} fragment — safe to swap.</p>
	</div>`
})
