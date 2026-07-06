import { describe, expect, it } from 'vitest'
import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { checkConditionalChains } from '../checks/check-conditional-chains'
import type { SourceDocument } from '../source-document'

function positionAt(text: string, offset: number) {
	const before = text.slice(0, offset)
	const line = before.split('\n').length - 1
	const character = offset - (before.lastIndexOf('\n') + 1)
	return { line, character }
}

function runCheck(text: string): AeroDiagnostic[] {
	const diagnostics: AeroDiagnostic[] = []
	const document = {
		uri: { fsPath: '/test.html' },
		getText: () => text,
		positionAt: (offset: number) => positionAt(text, offset),
	} as SourceDocument
	checkConditionalChains(document, text, diagnostics)
	return diagnostics
}

describe('checkConditionalChains', () => {
	it('does not flag else inside quoted attribute values', () => {
		const text = `<header-component
			title="Reactive conditionals"
			subtitle="Reactive if / else-if / <code>else</code>" />`

		const diagnostics = runCheck(text)
		const conditionalDiag = diagnostics.find(d =>
			d.message.includes('must follow an element with if or else-if')
		)
		expect(conditionalDiag).toBeUndefined()
	})

	it('does not flag else-if inside quoted attribute values', () => {
		const text = `<my-component label="supports else-if syntax" />`
		const diagnostics = runCheck(text)
		expect(
			diagnostics.some(d => d.message.includes('must follow an element with if or else-if'))
		).toBe(false)
	})

	it('still flags orphaned else without preceding if', () => {
		const text = `<div aero-else>Else</div>`
		const diagnostics = runCheck(text)
		expect(
			diagnostics.some(d => d.message.includes('else must follow an element with if or else-if'))
		).toBe(true)
	})

	it('does not flag valid if-else-if-else chain', () => {
		const text = `<p if="{a}">A</p>
<p else-if="{b}">B</p>
<p else>C</p>`
		const diagnostics = runCheck(text)
		expect(
			diagnostics.some(d => d.message.includes('must follow an element with if or else-if'))
		).toBe(false)
	})
})
