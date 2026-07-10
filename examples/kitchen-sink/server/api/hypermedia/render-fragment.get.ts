import { defineHandler } from 'nitro/h3'
import { fragmentResponse, renderAeroFragment } from '@aero-js/core/runtime/fragment'

export default defineHandler(async () => {
	await new Promise(resolve => setTimeout(resolve, 300))
	const time = new Date().toLocaleTimeString()

	const html = await renderAeroFragment(
		'client/components/fragment.html',
		{ message: `Fragment rendered at: ${time}` },
		{ root: process.cwd() }
	)

	return fragmentResponse(html)
})
