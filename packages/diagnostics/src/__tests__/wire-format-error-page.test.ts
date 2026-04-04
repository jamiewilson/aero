/**
 * Wire format (header / JSON) and dev SSR error HTML round-trip.
 */

import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	buildDevSsrErrorHtml,
	extractDiagnosticsFromDevErrorHtml,
} from '../error-page'
import {
	decodeDiagnosticsHeaderValue,
	encodeDiagnosticsHeaderValue,
	parseDiagnosticsJson,
} from '../wire-format'
import type { AeroDiagnostic } from '../types'

const sample: AeroDiagnostic[] = [
	{
		code: 'AERO_COMPILE',
		severity: 'error',
		message: 'bad <script> edge',
		file: '/proj/pages/a.html',
		span: { file: '/proj/pages/a.html', line: 2, column: 0 },
		frame: '> 2 | x\n  | ^',
	},
]

describe('wire-format and error-page', () => {
	it('round-trips diagnostics via base64 header encoding', () => {
		const enc = encodeDiagnosticsHeaderValue(sample)
		const dec = decodeDiagnosticsHeaderValue(enc)
		expect(dec).toEqual(sample)
	})

	it('parseDiagnosticsJson rejects invalid payloads', () => {
		expect(parseDiagnosticsJson(null)).toBeNull()
		expect(parseDiagnosticsJson({})).toBeNull()
		expect(parseDiagnosticsJson([{ code: 1 }])).toBeNull()
	})

	it('extractDiagnosticsFromDevErrorHtml reads script payload from buildDevSsrErrorHtml', () => {
		const html = buildDevSsrErrorHtml(sample)
		expect(html).toContain('bad &lt;script&gt; edge')
		expect(html).toContain('<h1>Aero Compiler Error</h1>')
		expect(html).toContain('<title>Aero Compiler Error</title>')
		expect(html).not.toContain('class="aero-diag-banner')
		const parsed = extractDiagnosticsFromDevErrorHtml(html)
		expect(parsed).toEqual(sample)
	})

	it('encodeDiagnosticsHeaderValue uses paths relative to cwd when file is under project', () => {
		const inRepo = path.join(process.cwd(), 'packages/core/vite-error.ts')
		const row: AeroDiagnostic[] = [
			{
				code: 'AERO_COMPILE',
				severity: 'error',
				message: 'x',
				file: inRepo,
				span: { file: inRepo, line: 1, column: 0 },
			},
		]
		const dec = decodeDiagnosticsHeaderValue(encodeDiagnosticsHeaderValue(row))
		expect(dec).not.toBeNull()
		expect(dec![0]!.file?.replace(/\\/g, '/')).toMatch(/^packages\/core\/vite-error\.ts$/)
		expect(dec![0]!.span?.file?.replace(/\\/g, '/')).toMatch(/^packages\/core\/vite-error\.ts$/)
	})
})
