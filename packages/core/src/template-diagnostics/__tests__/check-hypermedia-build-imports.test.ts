import { describe, expect, it } from 'vitest'
import type { AeroDiagnostic } from '@aero-js/diagnostics'
import {
	HYPERMEDIA_BUILD_IMPORT_MESSAGE,
	HYPERMEDIA_STATE_IMPORT_MESSAGE,
} from '@aero-js/compiler/hypermedia-build-imports'
import { checkHypermediaBuildImports } from '../checks/check-hypermedia-build-imports'
import type { SourceDocument } from '../source-document'

function makeDocument(text: string): SourceDocument {
	return {
		uri: { fsPath: '/tmp/page.html' },
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

describe('checkHypermediaBuildImports', () => {
	it('flags GET/POST imports in is:build', () => {
		const text = `<script is:build>
	import { GET, POST } from '@aero-js/hypermedia'
	import base from '@layouts/base.html'
</script>`
		const diagnostics: AeroDiagnostic[] = []
		checkHypermediaBuildImports(makeDocument(text), text, diagnostics)
		expect(diagnostics).toHaveLength(2)
		expect(diagnostics.every(d => d.message === HYPERMEDIA_BUILD_IMPORT_MESSAGE)).toBe(true)
		expect(diagnostics.every(d => d.code === 'AERO_COMPILE')).toBe(true)
	})

	it('flags missing GET import in is:state', () => {
		const text = `<script is:state>
	const load = () => GET('/api/x')
</script>`
		const diagnostics: AeroDiagnostic[] = []
		checkHypermediaBuildImports(makeDocument(text), text, diagnostics)
		expect(diagnostics).toHaveLength(1)
		expect(diagnostics[0]?.message).toBe(HYPERMEDIA_STATE_IMPORT_MESSAGE)
		expect(diagnostics[0]?.code).toBe('AERO_COMPILE')
	})

	it('allows action imports in is:state and non-action hypermedia imports in is:build', () => {
		const text = `<script is:build>
	import { createHypermediaRuntime } from '@aero-js/hypermedia'
</script>
<script is:state>
	import { GET } from '@aero-js/hypermedia'
	const load = () => GET('/api/x')
</script>`
		const diagnostics: AeroDiagnostic[] = []
		checkHypermediaBuildImports(makeDocument(text), text, diagnostics)
		expect(diagnostics).toEqual([])
	})
})
