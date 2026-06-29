import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineHandler } from 'nitro/h3'
import { fragmentResponse, renderAeroFragment } from '@aero-js/core/runtime/fragment'

// server/api/hypermedia → kitchen-sink root (client/ lives here)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

export default defineHandler(async () => {
	const html = await renderAeroFragment(
		'client/components/hypermedia/status-fragment.html',
		{ message: `Fragment rendered at ${new Date().toISOString()}` },
		{ root }
	)
	return fragmentResponse(html)
})
