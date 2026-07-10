import { defineHandler, HTTPError } from 'nitro/h3'

export default defineHandler(() => {
	throw HTTPError.status(404, 'Demo API route not found')
})
