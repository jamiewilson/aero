import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { Lowerer } from '../lowerer'
import { Resolver } from '../../resolver'

describe('Lowerer wrapperless foundation', () => {
	const resolver = new Resolver({ root: '/', resolvePath: (s) => s, importer: '/' })

	it('compileWrapperlessNode emits child markup without template tags', () => {
		const { document } = parseHTML(
			'<html><body><template><span class="x">hi</span></template></body></html>'
		)
		const template = document.body!.firstElementChild!
		const lowerer = new Lowerer(resolver)
		const ir = lowerer.compileWrapperlessNode(template, false, '__out')
		const serialized = JSON.stringify(ir)
		expect(serialized).not.toContain('<template')
		expect(serialized).not.toContain('</template>')
		expect(ir.some((n: any) => n.kind === 'Append' && String(n.content).includes('<span'))).toBe(true)
		expect(serialized).toMatch(/hi/)
	})

	it('compileWrapperAwareBranch uses wrapperless path for template', () => {
		const { document } = parseHTML('<html><body><template><b>z</b></template></body></html>')
		const template = document.body!.firstElementChild!
		const lowerer = new Lowerer(resolver)
		const ir = lowerer.compileWrapperAwareBranch(template, false, '__out')
		const serialized = JSON.stringify(ir)
		expect(serialized).not.toContain('template')
		expect(serialized).toContain('<b>')
	})

	it('compileWrapperAwareBranch preserves element wrapper for div', () => {
		const { document } = parseHTML(
			'<html><body><div class="p"><i>y</i></div></body></html>'
		)
		const div = document.body!.firstElementChild!
		const lowerer = new Lowerer(resolver)
		const ir = lowerer.compileWrapperAwareBranch(div, false, '__out')
		const serialized = JSON.stringify(ir)
		expect(ir.some((n: any) => n.kind === 'Append' && String(n.content).includes('<div'))).toBe(true)
		expect(serialized).toContain('</div>')
	})
})
