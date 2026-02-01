import { defineHandler, readBody } from 'nitro/h3'
import type { SubmitPost } from '@src/types'

export default defineHandler(async event => {
	const body = (await readBody(event)) as SubmitPost
	return `
		<div class="toast-content">
			<span>Server received POST:</span>
			<code>{ message: ${body.message} }</code>
			<span>at <code>/api/submit</code></span>
		</div>
	`
})
