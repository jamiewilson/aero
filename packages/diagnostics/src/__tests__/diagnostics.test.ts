import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	AeroBuildCancelledError,
	AeroCompileError,
	aeroDiagnosticToViteErrorFields,
	AERO_EXIT_BUILD_CANCELLED,
	AERO_EXIT_COMPILE,
	AERO_EXIT_CONTENT,
	AERO_EXIT_BUILD_GENERIC,
	AERO_EXIT_ROUTE,
	diagnosticsToSingleMessage,
	enrichDiagnosticsWithSourceFrames,
	exitCodeForDiagnostics,
	exitCodeForThrown,
	formatDiagnosticsBrowserHtml,
	formatDiagnosticsTerminal,
	formatSourceFrameFromSource,
	buildDevSsrErrorHtml,
	extractDiagnosticsFromDevErrorHtml,
	unknownToAeroDiagnostics,
} from '../index'

describe('diagnostics', () => {
	it('unknownToAeroDiagnostics maps Error', () => {
		const err = new Error('oops')
		err.stack = 'Error: oops\n    at <anonymous>:0:0'
		const d = unknownToAeroDiagnostics(err, {
			file: '/x/y.html',
			code: 'AERO_COMPILE',
		})
		expect(d).toHaveLength(1)
		expect(d[0]!.message).toBe('oops')
		expect(d[0]!.code).toBe('AERO_COMPILE')
		expect(d[0]!.file).toBe('/x/y.html')
	})

	it('unknownToAeroDiagnostics uses stack location and hint when page differs', () => {
		const err = new Error('toggle is not defined')
		err.stack = `ReferenceError: toggle is not defined
    at render (/proj/frontend/components/toggle.html.js:5:1)`
		const d = unknownToAeroDiagnostics(err, { file: '/proj/frontend/pages/index.html' })
		expect(d[0]!.file).toBe('/proj/frontend/components/toggle.html.js')
		expect(d[0]!.span).toEqual({
			file: '/proj/frontend/components/toggle.html.js',
			line: 5,
			column: 1,
		})
		expect(d[0]!.hint).toContain('while rendering')
		expect(d[0]!.hint).toContain('index.html')
	})

	it('formatDiagnosticsTerminal includes title, path, and message', () => {
		const text = formatDiagnosticsTerminal([
			{
				code: 'AERO_PARSE',
				severity: 'error',
				message: 'bad brace',
				file: 'pages/a.html',
				span: { file: 'pages/a.html', line: 2, column: 5 },
			},
		])
		expect(text).toContain('Aero Parse Error')
		expect(text).toContain('pages/a.html:2:5')
		expect(text).toContain('bad brace')
	})

	it('formatDiagnosticsTerminal uses warning banner titles for template/switch warnings', () => {
		const text = formatDiagnosticsTerminal([
			{
				code: 'AERO_TEMPLATE',
				severity: 'warning',
				message: 'template attrs ignored',
				file: 'pages/a.html',
			},
			{
				code: 'AERO_SWITCH',
				severity: 'warning',
				message: 'missing default',
				file: 'pages/b.html',
			},
		])
		expect(text).toContain('Aero Template Warning')
		expect(text).toContain('Aero Switch Warning')
	})

	it('aeroDiagnosticToViteErrorFields sets loc for overlay', () => {
		const fields = aeroDiagnosticToViteErrorFields(
			{
				code: 'AERO_COMPILE',
				severity: 'error',
				message: 'fail',
				file: 'client/pages/x.html',
				span: { file: 'client/pages/x.html', line: 4, column: 1 },
			},
			'vite-plugin-aero-transform'
		)
		expect(fields.loc).toEqual({
			file: 'client/pages/x.html',
			line: 4,
			column: 1,
		})
		expect(fields.message).toContain('[AERO_COMPILE]')
		expect(fields.message).toContain('client/pages/x.html')
		expect(fields.plugin).toBe('vite-plugin-aero-transform')
	})

	it('aeroDiagnosticToViteErrorFields fills loc.file from top-level file when span omits file', () => {
		const fields = aeroDiagnosticToViteErrorFields(
			{
				code: 'AERO_COMPILE',
				severity: 'error',
				message: 'fail',
				file: 'client/pages/y.html',
				span: { file: '', line: 2, column: 0 },
			},
			'vite-plugin-aero'
		)
		expect(fields.loc?.file).toBe('client/pages/y.html')
	})

	it('aeroDiagnosticToViteErrorFields passes frame for Vite overlay', () => {
		const fields = aeroDiagnosticToViteErrorFields(
			{
				code: 'AERO_COMPILE',
				severity: 'error',
				message: 'fail',
				file: 'a.html',
				span: { file: 'a.html', line: 1, column: 0 },
				frame: '> 1 | oops\n  | ^',
			},
			'vite-plugin-aero'
		)
		expect(fields.frame).toBe('> 1 | oops\n  | ^')
	})

	it('formatSourceFrameFromSource builds Rollup-style snippet', () => {
		const src = ['alpha', 'beta boo', 'gamma'].join('\n')
		const frame = formatSourceFrameFromSource(src, 2, 5)
		expect(frame).toContain('> 2 | beta boo')
		expect(frame).toContain('^')
	})

	it('formatSourceFrameFromSource expands tabs so caret lines up with code', () => {
		const src = ['@scope {', '\t:scope', '\tposition: fixed;'].join('\n')
		// Line 3 is `\tposition...`; 0-based column 1 is `p` (after tab expanded to two spaces).
		const frame = formatSourceFrameFromSource(src, 3, 1)
		const lines = frame.split('\n')
		const codeLine = lines.find(l => l.includes('position:'))!
		const caretLine = lines.find(l => l.trimEnd().endsWith('^'))!
		expect(codeLine.indexOf('p')).toBe(caretLine.indexOf('^'))
	})

	it('enrichDiagnosticsWithSourceFrames reads disk when file exists', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-frame-'))
		const file = path.join(dir, 't.html')
		fs.writeFileSync(file, '<div>\n  bad\n</div>\n', 'utf8')
		const enriched = enrichDiagnosticsWithSourceFrames([
			{
				code: 'AERO_COMPILE',
				severity: 'error',
				message: 'nope',
				file,
				span: { file, line: 2, column: 2 },
			},
		])
		expect(enriched[0]!.frame).toBeDefined()
		expect(enriched[0]!.frame).toContain('> 2 |   bad')
		fs.rmSync(dir, { recursive: true, force: true })
	})

	it('exitCodeForDiagnostics maps codes to CI buckets', () => {
		expect(
			exitCodeForDiagnostics([
				{
					code: 'AERO_CONTENT_SCHEMA',
					severity: 'error',
					message: 'x',
				},
			])
		).toBe(AERO_EXIT_CONTENT)
		expect(exitCodeForDiagnostics([{ code: 'AERO_PARSE', severity: 'error', message: 'x' }])).toBe(
			AERO_EXIT_COMPILE
		)
		expect(
			exitCodeForDiagnostics([{ code: 'AERO_INTERNAL', severity: 'error', message: 'x' }])
		).toBe(AERO_EXIT_BUILD_GENERIC)
		expect(
			exitCodeForDiagnostics([{ code: 'AERO_ROUTE', severity: 'warning', message: 'no match' }])
		).toBe(AERO_EXIT_ROUTE)
	})

	it('exitCodeForThrown maps AeroBuildCancelledError to AERO_EXIT_BUILD_CANCELLED', () => {
		expect(exitCodeForThrown(new AeroBuildCancelledError({ message: 'cancelled' }))).toBe(
			AERO_EXIT_BUILD_CANCELLED
		)
	})

	it('diagnosticsToSingleMessage joins multiple', () => {
		const m = diagnosticsToSingleMessage([
			{
				code: 'AERO_COMPILE',
				severity: 'error',
				message: 'one',
				file: 'a.html',
			},
			{
				code: 'AERO_PARSE',
				severity: 'error',
				message: 'two',
				file: 'b.html',
			},
		])
		expect(m.split('\n')).toHaveLength(2)
		expect(m).toContain('one')
		expect(m).toContain('two')
	})

	it('unknownToAeroDiagnostics maps AeroCompileError', () => {
		const err = new AeroCompileError({
			message: 'bad',
			file: 'x.html',
			line: 1,
			column: 2,
		})
		const d = unknownToAeroDiagnostics(err)
		expect(d[0]!.code).toBe('AERO_COMPILE')
		expect(d[0]!.span).toEqual({ file: 'x.html', line: 1, column: 2 })
	})

	it('unknownToAeroDiagnostics maps ContentSchemaAggregateError-shaped payload', () => {
		const err = {
			_tag: 'ContentSchemaAggregateError' as const,
			message: 'ignored for diagnostics',
			issues: [
				{
					collection: 'docs',
					relPath: 'bad.md',
					file: '/proj/content/docs/bad.md',
					messages: ['title required'],
				},
			],
		}
		const d = unknownToAeroDiagnostics(err)
		expect(d).toHaveLength(1)
		expect(d[0]!.code).toBe('AERO_CONTENT_SCHEMA')
		expect(d[0]!.severity).toBe('error')
		expect(d[0]!.file).toBe('/proj/content/docs/bad.md')
		expect(d[0]!.message).toContain('bad.md')
		expect(d[0]!.message).toContain('title required')
	})

	it('formatDiagnosticsBrowserHtml escapes markup', () => {
		const html = formatDiagnosticsBrowserHtml([
			{
				code: 'AERO_COMPILE',
				severity: 'error',
				message: '<script>alert(1)</script>',
				hint: 'use & carefully',
			},
		])
		expect(html).not.toContain('<script>')
		expect(html).toContain('&lt;script&gt;')
		expect(html).toContain('&amp;')
		expect(html).toContain('aero-diag-block')
		expect(html).toContain('data-aero-code="AERO_COMPILE"')
	})

	it('formatDiagnosticsBrowserHtml includes escaped frame', () => {
		const html = formatDiagnosticsBrowserHtml([
			{
				code: 'AERO_PARSE',
				severity: 'error',
				message: 'x',
				frame: '<tag>',
			},
		])
		expect(html).toContain('aero-diag-frame')
		expect(html).toContain('&lt;tag&gt;')
		expect(html).toContain('Aero Parse Error')
	})

	it('preserves code/message across terminal, vite, browser, and SSR transport', () => {
		const d = {
			code: 'AERO_COMPILE' as const,
			severity: 'error' as const,
			message: 'Directive props must be braced',
			file: 'client/pages/bad.html',
			span: { file: 'client/pages/bad.html', line: 1, column: 31 },
			frame: '> 1 | <div props="x">\n  |                               ^',
		}

		const terminal = formatDiagnosticsTerminal([d], { plain: true })
		expect(terminal).toContain('[AERO_COMPILE]')
		expect(terminal).toContain('Directive props must be braced')

		const vite = aeroDiagnosticToViteErrorFields(d, 'vite-plugin-aero-transform')
		expect(vite.message).toContain('[AERO_COMPILE]')
		expect(vite.message).toContain('Directive props must be braced')
		expect(vite.loc).toEqual({ file: 'client/pages/bad.html', line: 1, column: 31 })

		const browser = formatDiagnosticsBrowserHtml([d])
		expect(browser).toContain('data-aero-code="AERO_COMPILE"')
		expect(browser).toContain('Directive props must be braced')

		const ssrHtml = buildDevSsrErrorHtml([d])
		const parsed = extractDiagnosticsFromDevErrorHtml(ssrHtml)
		expect(parsed).toEqual([d])
	})
})
