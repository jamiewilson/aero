import { describe, expect, it } from 'vitest'
import { emitClientScriptTag, VIRTUAL_PREFIX } from '../../emit-client-script-tag'
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
		expect(root.some(l => l.includes('__aeroScriptUrl') && l.includes('createScriptTag'))).toBe(
			true
		)
	})

	it('emits head script without scripts?.add wrapper', () => {
		const script: ScriptEntry = {
			content: `${vp}x.y.0.1`,
			injectInHead: true,
		}
		const { head, root } = emitClientScriptTag(script, vp)
		expect(root).toEqual([])
		expect(head.length).toBe(1)
		expect(head[0]).toContain('Aero.createScriptTag(')
	})

	it('emits pass-data body bundle with json + tag', () => {
		const script: ScriptEntry = {
			content: `${vp}p.0.1`,
			passDataExpr: 'props',
			injectInHead: false,
		}
		const { root } = emitClientScriptTag(script, vp)
		expect(root[0]).toContain('document.currentScript')
		expect(root[0]).toContain('escapeScriptJson')
		expect(root[0]).not.toContain('getElementById')
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
		expect(line).toContain('return \'<script type="application/json"')
		expect(line).toContain('document.currentScript')
		expect(line).toContain('__aeroScriptUrl')
		expect(line).toContain('Aero.createScriptTag(')
		expect(line).not.toContain('nextPassDataId')
		expect(line).not.toContain('getElementById')
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
