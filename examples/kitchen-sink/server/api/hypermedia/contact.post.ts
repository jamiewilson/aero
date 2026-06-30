import { defineHandler, readBody } from 'nitro/h3'

interface ContactBody {
	message?: string
}

export default defineHandler(async event => {
	const body = (await readBody(event)) as ContactBody
	const message = body.message?.trim() || '(empty)'
	return `Received: <code>${message}</code>`
})
