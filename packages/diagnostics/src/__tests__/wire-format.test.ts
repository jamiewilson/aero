/**
 * Wire format: encode/decode, parseDiagnosticsJson with full field round-trip.
 */

import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	decodeDiagnosticsHeaderValue,
	diagnosticsForWire,
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

describe('parseDiagnosticsJson', () => {
	it('rejects non-array', () => {
		expect(parseDiagnosticsJson(null)).toBeNull()
		expect(parseDiagnosticsJson({})).toBeNull()
		expect(parseDiagnosticsJson('string')).toBeNull()
	})

	it('rejects items with wrong types', () => {
		expect(parseDiagnosticsJson([{ code: 1 }])).toBeNull()
		expect(parseDiagnosticsJson([{ code: 'X', severity: 'bad', message: 'x' }])).toBeNull()
	})

	it('parses valid diagnostic array', () => {
		const result = parseDiagnosticsJson(JSON.parse(JSON.stringify(sample)))
		expect(result).toEqual(sample)
	})

	it('round-trips lineEnd and columnEnd in span', () => {
		const withEndRange: AeroDiagnostic[] = [
			{
				code: 'AERO_COMPILE',
				severity: 'error',
				message: 'range error',
				file: 'a.html',
				span: { file: 'a.html', line: 1, column: 5, lineEnd: 1, columnEnd: 10 },
			},
		]
		const json = JSON.parse(JSON.stringify(withEndRange))
		const result = parseDiagnosticsJson(json)
		expect(result).toEqual(withEndRange)
		expect(result![0]!.span!.lineEnd).toBe(1)
		expect(result![0]!.span!.columnEnd).toBe(10)
	})

	it('preserves optional fields: hint, docsUrl, frame', () => {
		const full: AeroDiagnostic[] = [
			{
				code: 'AERO_COMPILE',
				severity: 'error',
				message: 'msg',
				hint: 'a hint',
				docsUrl: 'https://example.com',
				frame: '> 1 | x',
			},
		]
		const result = parseDiagnosticsJson(JSON.parse(JSON.stringify(full)))
		expect(result).toEqual(full)
	})
})

describe('encodeDiagnosticsHeaderValue / decodeDiagnosticsHeaderValue', () => {
	it('round-trips diagnostics via base64', () => {
		const enc = encodeDiagnosticsHeaderValue(sample)
		const dec = decodeDiagnosticsHeaderValue(enc)
		expect(dec).toEqual(sample)
	})

	it('uses paths relative to cwd when file is under project', () => {
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

	it('returns null for invalid base64', () => {
		expect(decodeDiagnosticsHeaderValue('not-valid!!!')).toBeNull()
	})
})

describe('diagnosticsForWire', () => {
	it('relativizes absolute paths under cwd', () => {
		const abs = path.join(process.cwd(), 'src/file.ts')
		const wire = diagnosticsForWire([
			{
				code: 'AERO_COMPILE',
				severity: 'error',
				message: 'x',
				file: abs,
				span: { file: abs, line: 1, column: 0 },
			},
		])
		expect(wire[0]!.file?.replace(/\\/g, '/')).toBe('src/file.ts')
		expect(wire[0]!.span?.file?.replace(/\\/g, '/')).toBe('src/file.ts')
	})
})
