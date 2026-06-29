import { describe, expect, it } from 'vitest'
import { parseOobSwaps } from '../oob'

describe('parseOobSwaps', () => {
	it('strips OOB nodes from primary HTML', () => {
		const html = `<div id="main">primary</div><div id="side" data-aero-oob="innerHTML">side</div>`
		const { primaryHtml, oobSwaps } = parseOobSwaps(html)
		expect(primaryHtml).toBe('<div id="main">primary</div>')
		expect(oobSwaps).toHaveLength(1)
	})

	it('parses swap mode from data-aero-oob defaulting to outerHTML', () => {
		const html = `<div id="a" data-aero-oob>alpha</div><div id="b" data-aero-oob="beforeend">beta</div>`
		const { oobSwaps } = parseOobSwaps(html)
		expect(oobSwaps).toEqual([
			{ id: 'a', html: '<div id="a" data-aero-oob="">alpha</div>', style: 'outerHTML' },
			{ id: 'b', html: '<div id="b" data-aero-oob="beforeend">beta</div>', style: 'beforeend' },
		])
	})

	it('preserves OOB order from response document', () => {
		const html = `<div id="first" data-aero-oob>1</div><div id="second" data-aero-oob>2</div>`
		const { oobSwaps } = parseOobSwaps(html)
		expect(oobSwaps.map(s => s.id)).toEqual(['first', 'second'])
	})

	it('skips OOB nodes without id', () => {
		const html = `<div data-aero-oob>orphan</div><div id="ok" data-aero-oob>ok</div>`
		const { oobSwaps } = parseOobSwaps(html)
		expect(oobSwaps).toHaveLength(1)
		expect(oobSwaps[0]?.id).toBe('ok')
	})
})
