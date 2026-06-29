import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fragmentResponse, renderAeroFragment } from '../fragment'

describe('renderAeroFragment', () => {
	it('renders a template file with props', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-fragment-'))
		const templatePath = path.join(dir, 'status.html')
		fs.writeFileSync(
			templatePath,
			`<script is:build>const { message } = Aero.props</script><p>{ message }</p>`,
			'utf8'
		)

		const html = await renderAeroFragment(templatePath, { message: 'live' }, { root: dir })
		expect(html).toContain('<p>live</p>')
	})
})

describe('fragmentResponse', () => {
	it('sets default fragment cache and content negotiation headers', () => {
		const response = fragmentResponse('<p>ok</p>')
		expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
		expect(response.headers.get('Cache-Control')).toBe('private, no-cache')
		expect(response.headers.get('Vary')).toBe('Accept')
	})

	it('allows callers to override defaults', () => {
		const response = fragmentResponse('<p>ok</p>', {
			headers: {
				'Cache-Control': 'public, max-age=60',
			},
		})
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=60')
		expect(response.headers.get('Vary')).toBe('Accept')
	})
})
