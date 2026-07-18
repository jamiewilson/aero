/**
 * Render-parity suite: one normalize+enrich path must yield identical span/frame/loc
 * across dev-console, terminal, and vite-overlay surfaces.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AeroCompileError } from '../tagged-errors'
import {
	enrichDiagnostics,
	normalizeToDiagnostics,
	renderDiagnostics,
	reportAeroFailure,
	type ViteOverlayRenderResult,
} from '../pipeline'
import { AERO_DIAGNOSTICS_ERROR_PROP } from '../vite-error-fields'
import { diagnosticPathForDisplay } from '../path-display'

const FIXED_NOW = new Date(2026, 6, 17, 12, 0, 0)

function locSuffix(file: string, line: number, column: number): string {
	return `${diagnosticPathForDisplay(file)}:${line}:${column}`
}

function assertSurfaceParity(diagnostics: ReturnType<typeof enrichDiagnostics>) {
	expect(diagnostics.length).toBeGreaterThan(0)
	const d0 = diagnostics[0]!

	const consoleText = renderDiagnostics(diagnostics, 'dev-console', {
		colors: false,
		now: FIXED_NOW,
	})
	const terminalText = renderDiagnostics(diagnostics, 'terminal', { plain: true })
	const overlay = renderDiagnostics(diagnostics, 'vite-overlay', {
		plugin: 'vite-plugin-aero-transform',
	}) as ViteOverlayRenderResult

	expect(overlay.message).toBe(d0.message)
	expect(overlay[AERO_DIAGNOSTICS_ERROR_PROP]).toEqual(diagnostics)

	if (d0.span && d0.span.line > 0) {
		const printed = locSuffix(d0.span.file || d0.file || '', d0.span.line, d0.span.column)
		expect(consoleText).toContain(printed)
		expect(terminalText).toContain(d0.message)
		expect(overlay.loc).toEqual({
			file: d0.span.file || d0.file,
			line: d0.span.line,
			column: Math.max(0, d0.span.column),
		})
		expect(overlay.id).toBe(d0.span.file ?? d0.file)
	} else {
		expect(overlay.loc).toBeUndefined()
	}

	if (d0.frame) {
		expect(consoleText).toContain(d0.frame.split('\n')[0]!)
		expect(terminalText).toContain(d0.frame.split('\n')[0]!)
		expect(overlay.frame).toBe(d0.frame)
	}
}

describe('pipeline render parity', () => {
	it('CompileError with loc: span/frame/printed loc match across surfaces', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-parity-compile-'))
		const file = path.join(dir, 'page.html')
		const source = '<div>\n  <span class:is-active="{ isActive }"></span>\n</div>\n'
		fs.writeFileSync(file, source)
		const err = new AeroCompileError({
			message: 'Reactive class binding `class:is-active` must reference a declared state variable.',
			file,
			line: 2,
			column: 8,
		})
		const diagnostics = enrichDiagnostics(normalizeToDiagnostics(err))
		expect(diagnostics[0]?.span).toEqual({ file, line: 2, column: 8 })
		expect(diagnostics[0]?.frame).toMatch(/>\s*2\s*\|/)
		assertSurfaceParity(diagnostics)
	})

	it('CompileError without loc: file-only, no fabricated overlay loc', () => {
		const err = new AeroCompileError({
			message: 'Malformed switch',
			file: '/proj/client/pages/x.html',
		})
		const diagnostics = enrichDiagnostics(normalizeToDiagnostics(err))
		expect(diagnostics[0]?.span).toBeUndefined()
		assertSurfaceParity(diagnostics)
		const overlay = renderDiagnostics(diagnostics, 'vite-overlay') as ViteOverlayRenderResult
		expect(overlay.id).toBe('/proj/client/pages/x.html')
		expect(overlay.loc).toBeUndefined()
	})

	it('Vite-corrupted loc still keeps frame from normalize when present on Error', () => {
		const file = '/proj/client/pages/demos/bindings.html'
		const frame =
			'> 46 | <div class:is-active="{ isActive }" class="card text-center">\n     |      ^'
		const err = Object.assign(
			new Error(
				'Reactive class binding `class:is-active` must reference a declared state variable.'
			),
			{
				id: file,
				plugin: 'vite-plugin-aero-transform',
				// TransformPluginContext can leave non-numeric loc after remap
				loc: { file, line: null, column: null },
				frame,
			}
		)
		const diagnostics = enrichDiagnostics(normalizeToDiagnostics(err))
		expect(diagnostics[0]?.frame).toBe(frame)
		expect(diagnostics[0]?.file).toBe(file)
		assertSurfaceParity(diagnostics)
	})

	it('CssSyntaxError: span/frame/printed loc match across surfaces', () => {
		const err = new Error('ignored')
		err.name = 'CssSyntaxError'
		const source = `${Array.from({ length: 14 }, () => 'x').join('\n')}\n  }`
		Object.assign(err, {
			reason: 'Unexpected }',
			file: '/kitchen-sink/index.html?html-proxy&index=3.css',
			line: 15,
			column: 3,
			source,
		})
		const diagnostics = enrichDiagnostics(normalizeToDiagnostics(err))
		expect(diagnostics[0]?.span?.line).toBe(15)
		expect(diagnostics[0]?.frame).toMatch(/>\s*15\s*\|/)
		assertSurfaceParity(diagnostics)
	})

	it('SSR PARSE_ERROR-shaped Error: Vite meta loc/frame survive normalize+render', () => {
		const file = '/proj/client/pages/demos/bindings.html'
		const frame = '    12 | const x = {\n  > 13 |   foo,\n       |      ^'
		const err = Object.assign(new Error('Parse failure: Unexpected token'), {
			code: 'PARSE_ERROR',
			id: file,
			loc: { file, line: 13, column: 6 },
			frame,
		})
		const diagnostics = enrichDiagnostics(normalizeToDiagnostics(err))
		expect(diagnostics[0]?.span).toEqual({ file, line: 13, column: 6 })
		expect(diagnostics[0]?.frame).toBe(frame)
		assertSurfaceParity(diagnostics)
	})

	it('reportAeroFailure(vite-overlay) matches enrich+render composition', () => {
		const err = new AeroCompileError({
			message: 'boom',
			file: '/proj/a.html',
			line: 1,
			column: 0,
		})
		const viaReport = reportAeroFailure(
			err,
			{ plugin: 'vite-plugin-aero-transform' },
			'vite-overlay'
		)
		const viaCompose = renderDiagnostics(
			enrichDiagnostics(normalizeToDiagnostics(err)),
			'vite-overlay',
			{ plugin: 'vite-plugin-aero-transform' }
		)
		expect(viaReport).toEqual(viaCompose)
	})

	it('thrownTo and unknownTo aliases share normalize implementation', async () => {
		const { thrownToAeroDiagnostics } = await import('../cause-map')
		const { unknownToAeroDiagnostics } = await import('../from-unknown')
		const err = new AeroCompileError({
			message: 'same',
			file: 'a.html',
			line: 2,
			column: 1,
		})
		expect(thrownToAeroDiagnostics(err)).toEqual(normalizeToDiagnostics(err))
		expect(unknownToAeroDiagnostics(err)).toEqual(normalizeToDiagnostics(err))
	})
})
