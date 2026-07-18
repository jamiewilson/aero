import { describe, expect, it } from 'vitest'
import { collectTemplateDiagnostics } from '../index'
import type { SourceDocument } from '../source-document'

function makeDoc(text: string): SourceDocument {
	return {
		uri: { fsPath: '/tmp/t.html' },
		getText: () => text,
		positionAt: (offset: number) => {
			const lines = text.slice(0, offset).split('\n')
			return { line: lines.length - 1, character: lines[lines.length - 1]?.length ?? 0 }
		},
		offsetAt: (position: { line: number; character: number }) => {
			const lines = text.split('\n')
			let offset = 0
			for (let i = 0; i < position.line; i++) offset += (lines[i]?.length ?? 0) + 1
			return offset + position.character
		},
	}
}

function sliceSpan(
	html: string,
	document: SourceDocument,
	span: NonNullable<import('@aero-js/diagnostics').AeroDiagnostic['span']>
): string {
	const start = document.offsetAt({ line: span.line, character: span.column })
	const end = document.offsetAt({
		line: span.lineEnd ?? span.line,
		character: span.columnEnd ?? span.column + 1,
	})
	return html.slice(start, end)
}

describe('class:* diagnostic ranges', () => {
	it('covers the full attribute for non-braced class:is-active="true"', () => {
		const html = `<script is:state>
	let isActive = false
</script>
<div class:is-active="true" class="card"></div>`
		const document = makeDoc(html)
		const diags = collectTemplateDiagnostics({
			document,
			root: '/tmp',
			flags: { reactivity: true, hypermedia: false },
		})
		const d = diags.find(x => x.message.includes('braced') && x.message.includes('class:is-active'))
		expect(d?.span?.columnEnd).toBeDefined()
		expect(sliceSpan(html, document, d!.span!)).toBe('class:is-active="true"')
	})

	it('covers the full attribute for empty class:is-active=""', () => {
		const html = `<script is:state>
	let isActive = false
</script>
<div class:is-active=""></div>`
		const document = makeDoc(html)
		const diags = collectTemplateDiagnostics({
			document,
			root: '/tmp',
			flags: { reactivity: true, hypermedia: false },
		})
		const d = diags.find(x => x.message.includes('braced'))
		expect(d?.span?.columnEnd).toBeDefined()
		expect(sliceSpan(html, document, d!.span!)).toBe('class:is-active=""')
	})

	it('covers the full attribute for undeclared class state-ref (not only the letter c)', () => {
		const html = `<script is:state>
	let count = 0
</script>
<div class:is-active="{ isActive }"></div>`
		const document = makeDoc(html)
		const diags = collectTemplateDiagnostics({
			document,
			root: '/tmp',
			flags: { reactivity: true, hypermedia: false },
		})
		const d = diags.find(x => x.message.includes('Reactive class binding'))
		expect(d).toBeDefined()
		expect(d!.span?.columnEnd).toBeDefined()
		const sliced = sliceSpan(html, document, d!.span!)
		expect(sliced.startsWith('class:is-active')).toBe(true)
		expect(sliced.length).toBeGreaterThan(1)
		expect(sliced).toBe('class:is-active="{ isActive }"')
	})
})
