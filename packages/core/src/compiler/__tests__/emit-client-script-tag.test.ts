import { describe, expect, it } from 'vitest'
import { emitClientScriptTag, VIRTUAL_PREFIX } from '../emit-client-script-tag'
import type { ScriptEntry } from '../../types'

describe('emitClientScriptTag', () => {
	const vp = VIRTUAL_PREFIX

	it('emits body script with virtual URL helper', () => {
		const script: ScriptEntry = {
			content: `${vp}pages/home.0.1`,
			injectInHead: false,
		}
		const { head, root } = emitClientScriptTag(script, vp)
		expect(head).toEqual([])
		expect(root.some(l => l.includes('__aeroScriptUrl') && l.includes('scripts?.add'))).toBe(true)
	})

	it('emits head script without scripts?.add wrapper', () => {
		const script: ScriptEntry = {
			content: `${vp}x.y.0.1`,
			injectInHead: true,
		}
		const { head, root } = emitClientScriptTag(script, vp)
		expect(root).toEqual([])
		expect(head.length).toBe(1)
		expect(head[0]).toMatch(/^'/)
	})

	it('emits pass-data body bundle with json + tag', () => {
		const script: ScriptEntry = {
			content: `${vp}p.0.1`,
			passDataExpr: 'props',
			injectInHead: false,
		}
		const { root } = emitClientScriptTag(script, vp)
		expect(root[0]).toContain('nextPassDataId')
		expect(root[0]).toContain('JSON.stringify')
	})

	it('emits pass-data head as one expression that returns concatenated HTML strings', () => {
		const script: ScriptEntry = {
			content: `${vp}p.0.1`,
			passDataExpr: 'props',
			injectInHead: true,
		}
		const { head, root } = emitClientScriptTag(script, vp)
		expect(root).toEqual([])
		expect(head.length).toBe(1)
		const line = head[0] ?? ''
		// Single IIFE whose return concatenates JSON + assignment + module tag (valid inside injectedHeadScripts?.add(...)).
		expect(line).toContain('return \'<script type="application/json"')
		expect(line).toContain('__aeroScriptUrl')
		expect(line).toContain('+(')
		expect(line.endsWith('})()')).toBe(true)
	})

	it('does not add a second type="module" when attrs already have TYPE=', () => {
		const script: ScriptEntry = {
			content: `${vp}x.0.1`,
			attrs: 'TYPE="module" defer',
			injectInHead: false,
		}
		const { root } = emitClientScriptTag(script, vp)
		const line = root[0] ?? ''
		expect(line.match(/type=/gi)?.length).toBe(1)
	})
})
