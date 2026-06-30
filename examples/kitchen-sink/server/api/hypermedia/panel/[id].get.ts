import { defineHandler, getRouterParam } from 'nitro/h3'

const panels: Record<string, string> = {
	a: 'Panel A — detail loaded on demand.',
	b: 'Panel B — a different server fragment.',
}

export default defineHandler(event => {
	const id = getRouterParam(event, 'id') ?? 'a'
	return panels[id] ?? `Unknown panel "${id}".`
})
