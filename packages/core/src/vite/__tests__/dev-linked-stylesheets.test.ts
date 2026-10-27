import { describe, expect, it } from 'vite-plus/test'
import { appendDirectQueryToDevStylesheetLinks } from '../dev-linked-stylesheets'

describe('appendDirectQueryToDevStylesheetLinks', () => {
	it('appends ?direct to local stylesheet links', () => {
		const html = '<head><link rel="stylesheet" href="/client/assets/styles/global.css"></head>'
		expect(appendDirectQueryToDevStylesheetLinks(html)).toBe(
			'<head><link rel="stylesheet" href="/client/assets/styles/global.css?direct"></head>'
		)
	})

	it('skips external and already-qualified hrefs', () => {
		const html =
			'<link rel="stylesheet" href="https://cdn.example.com/a.css">' +
			'<link rel="stylesheet" href="/a.css?v=1">'
		expect(appendDirectQueryToDevStylesheetLinks(html)).toBe(html)
	})
})
