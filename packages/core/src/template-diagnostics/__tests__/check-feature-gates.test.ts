import { describe, expect, it } from 'vitest'
import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { checkFeatureGates } from '../checks/check-feature-gates'
import type { SourceDocument } from '../source-document'

function makeDocument(text: string, fsPath: string): SourceDocument {
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
	it('reports is:state without reactivity at the script tag', () => {
		const text = `<script is:build>
	import base from '@layouts/base.html'
</script>

<script is:state>
	let count = 0
</script>

<p>{ count }</p>`
		const diagnostics: AeroDiagnostic[] = []
		checkFeatureGates(makeDocument(text, '/tmp/page.html'), text, diagnostics, {
			reactivity: false,
			hypermedia: false,
		})

		const match = diagnostics.find(d =>
			d.message.includes('`<script is:state>` requires `reactivity: true`')
		)
		expect(match).toBeDefined()
		expect(match!.span?.line).toBeGreaterThan(0)
	})

	it('reports invalid hypermedia state signal references', () => {
		const text = `<script is:state>
			let status = 'idle'
		</script>
		<button busy="{ missing }" on:click="{ POST('/api/save', { state: 'status' }) }">Save</button>`
		const diagnostics: AeroDiagnostic[] = []

		checkFeatureGates(makeDocument(text, '/tmp/page.html'), text, diagnostics, {
			reactivity: true,
			hypermedia: true,
		})

		expect(diagnostics.map(d => d.message)).toEqual([
			'Hypermedia busy signal not found: missing',
			'Hypermedia action `state` must reference a boolean state binding, not a string.',
		])
	})
})
