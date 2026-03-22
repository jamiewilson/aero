/**
 * Round-trip and HTML extraction for dev SSR diagnostic transport.
 */

import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	buildDevSsrErrorHtml,
	decodeDiagnosticsHeaderValue,
	encodeDiagnosticsHeaderValue,
	extractDiagnosticsFromDevErrorHtml,
	parseDiagnosticsJson,
} from '../dev-ssr-transport'
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

describe('dev-ssr-transport', () => {
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
