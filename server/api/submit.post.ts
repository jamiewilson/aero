import { defineHandler, readBody } from 'nitro/h3'

export default defineHandler(async event => {
	const body = (await readBody(event)) as { message: string }
	return `
		<p>Response:</p>
		<h1>${body.message}</h1>
	`
})
