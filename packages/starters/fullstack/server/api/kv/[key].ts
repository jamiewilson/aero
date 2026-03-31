import { defineHandler, getRouterParam } from 'nitro/h3'
import { useStorage } from 'nitro/storage'

export default defineHandler(async event => {
	const key = getRouterParam(event, 'key')
	const storage = useStorage('data')

	return {
		key,
		value: key ? await storage.getItem(key) : null,
	}
})
