/**
 * Unit tests for the IR emitter (emit.ts): hand-built IR → JS string.
 */

import { describe, it, expect } from 'vitest'
import type { IRNode } from '../ir'
import { emitToJS, emitBodyAndStyle } from '../emit'
import * as Helper from '../helpers'

describe('emitToJS', () => {
	it('emits Append nodes', () => {
		const ir: IRNode[] = [
			{ kind: 'Append', content: '<div>hello</div>' },
		]
		const out = emitToJS(ir)
		expect(out).toBe(Helper.emitAppend('<div>hello</div>', '__out'))
	})

	it('emits For with body', () => {
		const ir: IRNode[] = [
			{
				kind: 'For',
				item: 'item',
				items: 'items',
				body: [
					{ kind: 'Append', content: '<li>${item}</li>' },
				],
			},
		]
		const out = emitToJS(ir)
		expect(out).toContain('for (const item of items) {')
		expect(out).toContain('__out += `<li>${item}</li>`;')
		expect(out).toContain('}\n')
	})

	it('emits If with body', () => {
		const ir: IRNode[] = [
			{
				kind: 'If',
				condition: 'show',
				body: [{ kind: 'Append', content: '<p>yes</p>' }],
			},
		]
		const out = emitToJS(ir)
		expect(out).toContain('if (show) {')
		expect(out).toContain('__out += `<p>yes</p>`;')
		expect(out).toContain('}\n')
	})

	it('emits If with else-if and else', () => {
		const ir: IRNode[] = [
			{
				kind: 'If',
				condition: 'x === 1',
				body: [{ kind: 'Append', content: 'one' }],
				elseIf: [{ condition: 'x === 2', body: [{ kind: 'Append', content: 'two' }] }],
				else: [{ kind: 'Append', content: 'other' }],
			},
		]
		const out = emitToJS(ir)
		expect(out).toContain('if (x === 1) {')
		expect(out).toContain('} else if (x === 2) {')
		expect(out).toContain('} else {')
		expect(out).toContain('__out += `other`;')
	})

	it('emits Slot node', () => {
		const ir: IRNode[] = [
			{ kind: 'Slot', name: 'default', defaultContent: 'fallback' },
		]
		const out = emitToJS(ir)
		expect(out).toBe(Helper.emitSlotOutput('default', 'fallback', '__out'))
	})

	it('emits SlotVar then Slot', () => {
		const ir: IRNode[] = [
			{ kind: 'SlotVar', varName: '__slot_0' },
			{ kind: 'Append', content: 'content', outVar: '__slot_0' },
		]
		const out = emitToJS(ir)
		expect(out).toContain('let __slot_0 = \'\';')
		expect(out).toContain('__slot_0 += `content`;')
	})

	it('emits Component with slots', () => {
		const ir: IRNode[] = [
			{
				kind: 'Component',
				baseName: 'header',
				propsString: '{ title: "Hi" }',
				slots: { default: [{ kind: 'Append', content: 'slot body' }] },
				slotVarMap: { default: '__slot_0' },
			},
		]
		const out = emitToJS(ir)
		expect(out).toContain('let __slot_0 = \'\';')
		expect(out).toContain('__slot_0 += `slot body`;')
		expect(out).toContain('__out += await Aero.renderComponent(header, { title: "Hi" }, { "default": __slot_0 }')
	})

	it('emits Component with headScripts so layout head scripts are injected', () => {
		const ir: IRNode[] = [
			{
				kind: 'Component',
				baseName: 'baseLayout',
				propsString: '{}',
				slots: { default: [{ kind: 'Append', content: 'page' }] },
				slotVarMap: { default: '__slot_0' },
			},
		]
		const out = emitToJS(ir)
		// Layouts/components with plain <script> in <head> must receive the root headScripts set
		// so their bundled script tags are injected into the final <head>.
		expect(out).toContain('headScripts: injectedHeadScripts')
	})

	it('emits with custom outVar', () => {
		const ir: IRNode[] = [
			{ kind: 'Append', content: 'x', outVar: '__html' },
		]
		const out = emitToJS(ir, '__html')
		expect(out).toContain('__html += `x`;')
	})
})

describe('emitBodyAndStyle', () => {
	it('returns bodyCode and empty styleCode when no style IR', () => {
		const ir = { body: [{ kind: 'Append', content: '<div></div>' }], style: [] }
		const { bodyCode, styleCode } = emitBodyAndStyle(ir)
		expect(bodyCode).toContain('__out += `<div></div>`;')
		expect(styleCode).toBe('')
	})

	it('wraps style IR in style var and styles?.add()', () => {
		const ir = {
			body: [],
			style: [{ kind: 'Append', content: ':root { }' }],
		}
		const { bodyCode, styleCode } = emitBodyAndStyle(ir)
		expect(bodyCode).toBe('')
		expect(styleCode).toMatch(/let __out_style_\w+ = '';/)
		expect(styleCode).toContain('styles?.add(')
	})
})
