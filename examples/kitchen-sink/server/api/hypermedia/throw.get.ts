import { defineHandler, HTTPError } from 'nitro/h3'

/** Intentional HTTPError — JSON to the client; youch in the terminal via server/plugins/runtime.ts. */
export default defineHandler(() => {
	throw HTTPError.status(500, 'Deliberate hypermedia demo throw')
})
