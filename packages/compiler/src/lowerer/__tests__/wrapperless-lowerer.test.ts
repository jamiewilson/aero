import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { Lowerer } from '../lowerer'
import { Resolver } from '../../resolver'

describe('Lowerer wrapperless foundation', () => {
	const resolver = new Resolver({ root: '/', resolvePath: s => s, importer: '/' })

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
		expect(ir.some((n: any) => n.kind === 'Append' && String(n.content).includes('<span'))).toBe(
			true
		)
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
		const { document } = parseHTML('<html><body><div class="p"><i>y</i></div></body></html>')
		const div = document.body!.firstElementChild!
		const lowerer = new Lowerer(resolver)
		const ir = lowerer.compileWrapperAwareBranch(div, false, '__out')
		const serialized = JSON.stringify(ir)
		expect(ir.some((n: any) => n.kind === 'Append' && String(n.content).includes('<div'))).toBe(
			true
		)
		expect(serialized).toContain('</div>')
	})

	it('compileNode lowers template data-for to For with wrapperless body', () => {
		const { document } = parseHTML(
			'<html><body><template data-for="{ const x of xs }"><span>{ x }</span></template></body></html>'
		)
		const template = document.body!.firstElementChild!
		const lowerer = new Lowerer(resolver)
		const ir = lowerer.compileNode(template, false, '__out')
		expect(ir).toHaveLength(1)
		expect(ir[0]?.kind).toBe('For')
		const body = (ir[0] as { kind: string; body?: unknown[] }).body
		expect(JSON.stringify(body)).not.toMatch(/<template/i)
	})
})
