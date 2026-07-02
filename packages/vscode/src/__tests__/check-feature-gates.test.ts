/**
 * Feature gate diagnostics: is:state requires reactivity; hypermedia signal validation.
 */
import { describe, it, expect } from 'vitest'
import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { checkFeatureGates } from '../../../core/src/template-diagnostics/checks/check-feature-gates'
import type { SourceDocument } from '../../../core/src/template-diagnostics/source-document'

const counterText = `<script is:build>
	import base from '@layouts/base.html'
</script>

<script is:state>
	let count = 0
</script>

<base-layout title="Reactivity Demo">
	<p>Count: <strong>{ count }</strong></p>
</base-layout>
`

function makeDoc(text: string, fsPath: string): SourceDocument {
	return {
		uri: { fsPath },
		getText: () => text,
		positionAt: (offset: number) => {
			const lines = text.slice(0, offset).split('\n')
			return {
				line: lines.length - 1,
				character: lines[lines.length - 1]?.length ?? 0,
			}
		},
		offsetAt: () => 0,
	}
}

describe('checkFeatureGates', () => {
	it('does not report when reactivity is enabled', () => {
		const diagnostics: AeroDiagnostic[] = []
		checkFeatureGates(makeDoc(counterText, '/tmp/page.html'), counterText, diagnostics, {
			reactivity: true,
			hypermedia: true,
		})

		const reactivityDiag = diagnostics.find(d =>
			d.message.includes('`<script is:state>` requires `reactivity: true`')
		)
		expect(reactivityDiag).toBeUndefined()
	})

	it('points is:state diagnostic at the script tag, not document start', () => {
		const diagnostics: AeroDiagnostic[] = []
		checkFeatureGates(makeDoc(counterText, '/tmp/page.html'), counterText, diagnostics, {
			reactivity: false,
			hypermedia: false,
		})

		const reactivityDiag = diagnostics.find(d =>
			d.message.includes('`<script is:state>` requires `reactivity: true`')
		)
		expect(reactivityDiag).toBeDefined()
		expect(reactivityDiag!.span?.line).toBeGreaterThan(0)
		expect(counterText.split('\n')[reactivityDiag!.span!.line]).toMatch(/is:state/)
	})

	it('reports visible invalid hypermedia state signal references', () => {
		const text = `<script is:state>
			let status = 'idle'
		</script>
		<button busy="{ missing }" on:click="{ POST('/api/save', { state: 'status' }) }">Save</button>`
		const diagnostics: AeroDiagnostic[] = []

		checkFeatureGates(makeDoc(text, '/tmp/page.html'), text, diagnostics, {
			reactivity: true,
			hypermedia: true,
		})

		expect(diagnostics.map(d => d.message)).toEqual([
			'Hypermedia busy signal not found: missing',
			'Hypermedia action `state` must reference a boolean state binding, not a string.',
		])
	})
})
