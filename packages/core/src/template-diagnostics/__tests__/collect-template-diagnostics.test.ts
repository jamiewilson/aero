import { PARITY_SCENARIOS } from '../../../../diagnostics/src/__tests__/fixtures/parity/index.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { collectTemplateDiagnostics } from '../index'
import type { SourceDocument } from '../source-document'

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../..')
const kitchenSinkHypermedia = path.join(
	repoRoot,
	'examples/kitchen-sink/client/pages/demos/hypermedia.html'
)

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
		offsetAt: (position: { line: number; character: number }) => {
			const lines = text.split('\n')
			let offset = 0
			for (let i = 0; i < position.line; i++) {
				offset += (lines[i]?.length ?? 0) + 1
			}
			return offset + position.character
		},
	}
}

describe('collectTemplateDiagnostics parity', () => {
	for (const scenario of PARITY_SCENARIOS) {
		const expectation = scenario.surfaces.vscode ?? scenario.surfaces.cli
		if (!expectation) continue

		it(`${scenario.id}: ${scenario.description}`, () => {
			const diagnostics = collectTemplateDiagnostics({
				document: makeDocument(scenario.html, '/tmp/client/pages/index.html'),
				root: '/tmp',
				flags: scenario.flags,
			})

			const match = diagnostics.find(
				d => d.code === expectation.code || d.message.includes(expectation.messageIncludes)
			)
			expect(match).toBeDefined()
			expect(match!.message).toContain(expectation.messageIncludes)
			expect(match!.code).toBe(expectation.code)
		})
	}
})

describe('collectTemplateDiagnostics feature flags', () => {
	it('loads reactivity and hypermedia flags from nested app root in monorepo workspace', () => {
		const text = fs.readFileSync(kitchenSinkHypermedia, 'utf-8')
		const diagnostics = collectTemplateDiagnostics({
			document: makeDocument(text, kitchenSinkHypermedia),
			root: repoRoot,
			workspaceRoot: repoRoot,
		})

		const configErrors = diagnostics.filter(d => d.code === 'AERO_CONFIG')
		expect(configErrors).toEqual([])
	})
})

describe('collectTemplateDiagnostics undefined variables gate', () => {
	it('runs undefined variable checks when build script exists', () => {
		const html = `<script is:build>
const title = 'Hello'
</script>
<p>{ missingVar }</p>`

		const diagnostics = collectTemplateDiagnostics({
			document: makeDocument(html, '/tmp/client/pages/index.html'),
			root: '/tmp',
			flags: { reactivity: false, hypermedia: false },
		})

		expect(diagnostics.some(d => d.message.includes("Variable 'missingVar' is not defined"))).toBe(true)
	})
})

describe('collectTemplateDiagnostics unused variables', () => {
	it('does not flag spread parameter as unused in is:state', () => {
		const html = `<script is:state>
const nextNumber = (values: number[]) => Math.max(0, ...values) + 1
let numbersArray = [1, 2, 3]
</script>
<button on:click="{ numbersArray.push(nextNumber(numbersArray)) }">Add</button>`

		const diagnostics = collectTemplateDiagnostics({
			document: makeDocument(html, '/tmp/client/pages/iterables.html'),
			root: '/tmp',
			flags: { reactivity: true, hypermedia: false },
		})

		const unusedValues = diagnostics.find(d =>
			d.message.includes("'values' is declared but its value is never read")
		)
		expect(unusedValues).toBeUndefined()
	})
})
