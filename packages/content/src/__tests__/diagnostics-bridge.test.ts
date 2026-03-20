/**
 * Content schema issues → AeroDiagnostic mapping.
 */
import { describe, it, expect } from 'vitest'
import { formatDiagnosticsTerminal } from '@aero-js/diagnostics'
import { contentSchemaIssuesToAeroDiagnostics } from '../diagnostics-bridge'
import type { ContentSchemaIssue } from '../types'

const sampleIssues: ContentSchemaIssue[] = [
	{
		collection: 'docs',
		relPath: 'bad.md',
		file: '/proj/content/docs/bad.md',
		messages: ['title is required'],
	},
	{
		collection: 'docs',
		relPath: 'other/broken.md',
		file: '/proj/content/docs/other/broken.md',
		messages: ['expected string', 'received number'],
	},
]

describe('contentSchemaIssuesToAeroDiagnostics', () => {
	it('maps each issue to AERO_CONTENT_SCHEMA with file and message', () => {
		const d = contentSchemaIssuesToAeroDiagnostics(sampleIssues, 'warning')
		expect(d).toHaveLength(2)
		expect(d[0]!.code).toBe('AERO_CONTENT_SCHEMA')
		expect(d[0]!.severity).toBe('warning')
		expect(d[0]!.file).toBe('/proj/content/docs/bad.md')
		expect(d[0]!.message).toContain('docs')
		expect(d[0]!.message).toContain('bad.md')
		expect(d[0]!.message).toContain('title is required')
		expect(d[1]!.severity).toBe('warning')
		expect(d[1]!.message).toContain('broken.md')
	})

	it('uses error severity for strict mode', () => {
		const d = contentSchemaIssuesToAeroDiagnostics(sampleIssues, 'error')
		expect(d.every(x => x.severity === 'error')).toBe(true)
	})

	it('formats through formatDiagnosticsTerminal with [aero] and code', () => {
		const text = formatDiagnosticsTerminal(
			contentSchemaIssuesToAeroDiagnostics(sampleIssues, 'warning')
		)
		expect(text).toContain('[aero]')
		expect(text).toContain('[AERO_CONTENT_SCHEMA]')
		expect(text).toContain('/proj/content/docs/bad.md')
	})
})
