import { describe, expect, it } from 'vitest'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { compileTemplate } from '../../codegen'
import { CompileError } from '../../types'
import {
	enrichDiagnostics,
	normalizeToDiagnostics,
	renderDiagnostics,
} from '@aero-js/diagnostics'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
}

describe('compiler spans by default', () => {
	it('feature-gate errors include line/column when template source is available', () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'aero-fg-span-'))
		const file = path.join(dir, 'page.html')
		const html = `<html>
<body>
<script is:state>let x = 1</script>
<p>{ x }</p>
</body>
</html>
`
		writeFileSync(file, html)

		let error: unknown
		try {
			compileTemplate(html, {
				...mockOptions,
				importer: file,
				reactivity: false,
				diagnosticTemplateSource: html,
			})
		} catch (err) {
			error = err
		}

		expect(error).toBeInstanceOf(CompileError)
		const compileError = error as CompileError
		expect(compileError.message).toContain('reactivity: true')
		expect(compileError.line).toBe(3)
		expect(compileError.column).toBeTypeOf('number')

		const diagnostics = enrichDiagnostics(normalizeToDiagnostics(compileError))
		const printed = renderDiagnostics(diagnostics, 'dev-console', { colors: false })
		expect(printed).toMatch(/page\.html:3:\d+/)
		expect(printed).toMatch(/>\s*3\s*\|/)
		expect(printed).toContain('is:state')
	})

	it('state-script diagnostics promote script ranges into template line/column', () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'aero-state-span-'))
		const file = path.join(dir, 'page.html')
		const html = `<script is:state>
	let a = 1
	let b = a + 2
	b = 10
</script>
<p>{ a }</p>
`
		writeFileSync(file, html)

		let error: unknown
		try {
			compileTemplate(html, {
				...mockOptions,
				importer: file,
				reactivity: true,
				diagnosticTemplateSource: html,
			})
		} catch (err) {
			error = err
		}

		expect(error).toBeInstanceOf(CompileError)
		const compileError = error as CompileError
		expect(compileError.message).toMatch(/Derived state `b` is read-only/)
		expect(compileError.line).toBeGreaterThanOrEqual(4)
		expect(compileError.column).toBeTypeOf('number')

		const diagnostics = enrichDiagnostics(normalizeToDiagnostics(compileError))
		expect(diagnostics[0]?.frame).toBeTruthy()
		expect(diagnostics[0]?.frame).toContain('b = 10')
	})

	it('structural switch errors include line/column before file-only fallback', () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'aero-switch-span-'))
		const file = path.join(dir, 'page.html')
		const html = `<div>
	<section switch="{ mode }">
		<p>orphan text</p>
	</section>
</div>
`
		writeFileSync(file, html)

		let error: unknown
		try {
			compileTemplate(html, {
				...mockOptions,
				importer: file,
				diagnosticTemplateSource: html,
			})
		} catch (err) {
			error = err
		}

		expect(error).toBeInstanceOf(CompileError)
		const compileError = error as CompileError
		expect(compileError.message).toMatch(/case|default|switch/i)
		expect(compileError.line).toBe(2)
		expect(compileError.column).toBeTypeOf('number')

		const diagnostics = enrichDiagnostics(normalizeToDiagnostics(compileError))
		const printed = renderDiagnostics(diagnostics, 'dev-console', { colors: false })
		expect(printed).toMatch(/page\.html:2:\d+/)
		expect(printed).toMatch(/>\s*2\s*\|/)
		expect(printed).toContain('switch')
	})
})
