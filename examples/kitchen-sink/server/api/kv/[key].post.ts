import { defineHandler, getRouterParam, readBody } from 'nitro/h3'
import { useStorage } from 'nitro/storage'

export default defineHandler(async event => {
	const key = getRouterParam(event, 'key')
	const body = await readBody<{ value: unknown }>(event)
	const storage = useStorage('data')

	if (!key) {
		return { ok: false }
	}

	await storage.setItem(key, body?.value ?? null)
	return { ok: true, key }
})
