import { defineHandler, readBody } from 'nitro/h3'

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
