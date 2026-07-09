import { defineHandler, getQuery } from 'nitro/h3'

export default defineHandler(event => {
	const query = getQuery(event)
	const n = String(query.n ?? '1')
	return `<div class="card p-4 text-sm bg-green-500/10">Item ${n} from server</div>`
})
