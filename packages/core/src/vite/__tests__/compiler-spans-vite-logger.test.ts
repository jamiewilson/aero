/**
 * Phase 2 regression: binding + structural errors print file:line:col + frame
 * through the same normalize → enrich → Vite-logger render path used in dev.
 */

import { describe, expect, it, vi } from 'vitest'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
	createDiagnosticLogGate,
	enrichDiagnostics,
	normalizeToDiagnostics,
	renderDiagnostics,
	reportAeroFailure,
} from '@aero-js/diagnostics'
import { htmlCompileTry } from '../compile-html-try'
import { compileHtmlSourceForVite } from '../compile-html-for-vite'
import { wrapAeroViteLogger } from '../aero-vite-logger'

function compileCatch(html: string, file: string, root: string): unknown {
	try {
		htmlCompileTry(file, () =>
			compileHtmlSourceForVite(
				html,
				file,
				{
					resolvedConfig: { root } as any,
					resolvePath: (specifier: string) => specifier,
					reactivity: true,
				},
				new Map()
			)
		)
	} catch (err) {
		return err
	}
	throw new Error('expected compile to throw')
}

describe('compiler spans via Vite logger path', () => {
	it('prints binding error with file:line:col + frame', () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'aero-vite-bind-'))
		const file = path.join(dir, 'bindings.html')
		const html = `<script is:state>
	let count = 0
</script>
<div class:is-active="{ isActive }"></div>
`
		writeFileSync(file, html)
		const caught = compileCatch(html, file, dir)

		const overlay = reportAeroFailure(
			caught,
			{ defaultFile: file, plugin: 'vite-plugin-aero-transform' },
			'vite-overlay'
		)
		expect(overlay.loc?.line).toBeTypeOf('number')
		expect(overlay.frame).toContain('class:is-active')

		const gate = createDiagnosticLogGate()
		const baseError = vi.fn()
		const wrapped = wrapAeroViteLogger({ error: baseError, hasColors: false } as any, gate)
		const err = Object.assign(new Error(overlay.message), {
			...overlay,
			plugin: 'vite-plugin-aero-transform',
		})
		wrapped.error(`Internal server error: ${err.message}`, { error: err })

		const printed = String(baseError.mock.calls[0]![0])
		expect(printed).toMatch(/bindings\.html:\d+:\d+/)
		expect(printed).toMatch(/>\s*\d+\s*\|/)
		expect(printed).toContain('class:is-active')
	})

	it('prints structural switch error with file:line:col + frame', () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'aero-vite-switch-'))
		const file = path.join(dir, 'switch.html')
		const html = `<div switch="{ mode }">
	<p>orphan</p>
</div>
`
		writeFileSync(file, html)
		const caught = compileCatch(html, file, dir)

		const diagnostics = enrichDiagnostics(normalizeToDiagnostics(caught), {
			defaultFile: file,
		})
		expect(diagnostics[0]?.span?.line).toBeTypeOf('number')
		expect(diagnostics[0]?.frame).toMatch(/switch/i)

		const printed = renderDiagnostics(diagnostics, 'dev-console', { colors: false })
		expect(printed).toMatch(/switch\.html:\d+:\d+/)
		expect(printed).toMatch(/>\s*\d+\s*\|/)

		const overlay = reportAeroFailure(
			caught,
			{ defaultFile: file, plugin: 'vite-plugin-aero-transform' },
			'vite-overlay'
		)
		expect(overlay.loc?.line).toBe(diagnostics[0]?.span?.line)
		expect(overlay.frame).toBeTruthy()
	})
})
