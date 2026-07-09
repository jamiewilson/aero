import { defineHandler, readBody } from 'nitro/h3'

interface SubmitPost {
	message: string
}

export default defineHandler(async event => {
	const body = (await readBody(event)) as SubmitPost
	return `
		<div class="card bg-green-500/10 p-2 text-sm">
			<span>Server received POST:</span>
			<code>{ message: ${body.message} }</code>
			<span>at <code>/api/submit</code></span>
		</div>
	`
})
