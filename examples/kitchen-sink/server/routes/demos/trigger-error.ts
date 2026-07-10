import { defineHandler, HTTPError } from 'nitro/h3'

/** Throws so Nitro's default Aero error handler renders `error.html` at 500. */
export default defineHandler(() => {
	throw HTTPError.status(500, 'Demo server route failure')
})
