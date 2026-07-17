import { defineHandler, HTTPError } from 'nitro/h3'

/** Intentional HTTPError — JSON to the client; youch in the terminal via Aero's Nitro runtime plugin. */
export default defineHandler(() => {
	throw HTTPError.status(500, 'Deliberate hypermedia demo throw')
})
