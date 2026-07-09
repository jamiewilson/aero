import { defineHandler, getQuery } from 'nitro/h3'

export default defineHandler(event => {
	const query = getQuery(event)
	const n = String(query.n ?? '1')
	return `<li class="card text-sm bg-green-500/10 p-4">Item ${n} from server</li>`
})
