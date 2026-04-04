/**
 * Layout builder: section ordering, conditional sections, compact mode.
 */

import { describe, expect, it } from 'vitest'
import { layoutDiagnostic, layoutDiagnosticCompact } from '../render/layout'
import type { AeroDiagnostic } from '../types'

const full: AeroDiagnostic = {
	code: 'AERO_COMPILE',
	severity: 'error',
	message: 'broken template',
	file: 'pages/a.html',
	span: { file: 'pages/a.html', line: 3, column: 5 },
	frame: '> 3 | bad\n  |     ^',
	hint: 'Check your braces',
	docsUrl: 'https://aero.dev/docs/compile',
}

const minimal: AeroDiagnostic = {
	code: 'AERO_INTERNAL',
	severity: 'error',
	message: 'something failed',
}

describe('layoutDiagnostic', () => {
	it('produces all sections for a fully-populated diagnostic', () => {
		const sections = layoutDiagnostic(full, 0, 1, { banners: true })
		const kinds = sections.map(s => s.kind)
		expect(kinds).toEqual([
			'banner-top',
			'file',
			'error',
			'frame',
			'hint',
			'docs',
			'banner-bottom',
		])
	})

	it('includes index section when total > 1', () => {
		const sections = layoutDiagnostic(full, 2, 5, { banners: true })
		const indexSection = sections.find(s => s.kind === 'index')
		expect(indexSection).toBeDefined()
		expect(indexSection!.value).toBe('(3 of 5)')
	})

	it('omits banners when banners: false', () => {
		const sections = layoutDiagnostic(full, 0, 1, { banners: false })
		const kinds = sections.map(s => s.kind)
		expect(kinds).not.toContain('banner-top')
		expect(kinds).not.toContain('banner-bottom')
	})

	it('omits frame, hint, docs sections when diagnostic lacks them', () => {
		const sections = layoutDiagnostic(minimal, 0, 1, { banners: false })
		const kinds = sections.map(s => s.kind)
		expect(kinds).toEqual(['file', 'error'])
	})

	it('shows (unknown) for file when no file is present', () => {
		const sections = layoutDiagnostic(minimal, 0, 1, { banners: false })
		const fileSection = sections.find(s => s.kind === 'file')
		expect(fileSection!.value).toBe('(unknown)')
	})

	it('includes file:line:column in file section when span is present', () => {
		const sections = layoutDiagnostic(full, 0, 1, { banners: false })
		const fileSection = sections.find(s => s.kind === 'file')
		expect(fileSection!.value).toContain('pages/a.html:3:5')
	})

	it('sets label on labeled sections', () => {
		const sections = layoutDiagnostic(full, 0, 1, { banners: false })
		expect(sections.find(s => s.kind === 'file')!.label).toBe('File')
		expect(sections.find(s => s.kind === 'error')!.label).toBe('Error')
		expect(sections.find(s => s.kind === 'hint')!.label).toBe('Hint')
		expect(sections.find(s => s.kind === 'docs')!.label).toBe('Docs')
	})
})

describe('layoutDiagnosticCompact', () => {
	it('produces a single-block [aero] formatted string', () => {
		const text = layoutDiagnosticCompact(full, 0, 1)
		expect(text).toContain('[aero]')
		expect(text).toContain('[AERO_COMPILE]')
		expect(text).toContain('pages/a.html:3:5')
		expect(text).toContain('error: broken template')
		expect(text).toContain('hint: Check your braces')
		expect(text).toContain('docs: https://aero.dev/docs/compile')
	})

	it('includes index prefix when total > 1', () => {
		const text = layoutDiagnosticCompact(full, 1, 3)
		expect(text).toContain('2/3 ')
	})
})
