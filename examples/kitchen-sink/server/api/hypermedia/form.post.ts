import { defineHandler, readBody } from 'nitro/h3'

interface FormBody {
	message?: string
}

export default defineHandler(async event => {
	const body = (await readBody(event)) as FormBody
	const message = body.message?.trim() || '(empty)'
	return `Received: <code>${message}</code>`
})
