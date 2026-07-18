import { describe, expect, it } from 'vitest'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { compileTemplate } from '../../codegen'
import { CompileError } from '../../types'
import {
	enrichDiagnostics,
	formatDiagnosticsDevConsole,
	normalizeToDiagnostics,
} from '@aero-js/diagnostics'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	reactivity: true as const,
}

describe('reactive class binding diagnostics', () => {
	it('includes line/column and a source frame for undeclared class bindings', () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'aero-frame-'))
		const file = path.join(dir, 'bindings.html')
		const html = `<script is:state>
	let count = 0
</script>
<div class:is-active="{ isActive }"></div>
`
		writeFileSync(file, html)

		let error: unknown
		try {
			compileTemplate(html, { ...mockOptions, importer: file, diagnosticTemplateSource: html })
		} catch (err) {
			error = err
		}

		expect(error).toBeInstanceOf(CompileError)
		const compileError = error as CompileError
		expect(compileError.message).toContain('class:is-active')
		expect(compileError.line).toBe(4)
		expect(compileError.column).toBeTypeOf('number')

		const diagnostics = enrichDiagnostics(normalizeToDiagnostics(compileError))
		const diagnostic = diagnostics[0]
		expect(diagnostic?.span?.line).toBe(4)
		expect(diagnostic?.frame).toBeTruthy()
		expect(diagnostic?.frame).toContain('class:is-active')
		expect(diagnostic?.frame).toContain('>')

		const printed = formatDiagnosticsDevConsole(diagnostics, { colors: false })
		expect(printed).toContain(`:${diagnostic!.span!.line}:`)
		expect(printed).toContain('class:is-active')
		expect(printed).toMatch(/>\s*\d+\s*\|/)
	})
})
