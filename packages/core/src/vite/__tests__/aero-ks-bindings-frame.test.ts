import { describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
	enrichDiagnostics,
	formatDiagnosticsDevConsole,
	normalizeToDiagnostics,
	reportAeroFailure,
} from '@aero-js/diagnostics'
import { htmlCompileTry } from '../compile-html-try'
import { compileHtmlSourceForVite } from '../compile-html-for-vite'

const KS = path.resolve(__dirname, '../../../../../examples/kitchen-sink')

describe('kitchen-sink bindings frame', () => {
	it('frames class binding error in real bindings.html shape', () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'aero-ks-frame-'))
		const client = path.join(dir, 'client')
		mkdirSync(path.join(client, 'pages/demos'), { recursive: true })
		mkdirSync(path.join(client, 'layouts'), { recursive: true })
		mkdirSync(path.join(client, 'components'), { recursive: true })

		// Minimal base layout so resolve works
		writeFileSync(
			path.join(client, 'layouts/base.html'),
			`<script is:build>
	const title = Aero.props.title
</script>
<html><body><slot /></body></html>
`
		)

		let html = readFileSync(path.join(KS, 'client/pages/demos/bindings.html'), 'utf8')
		// Force the undeclared binding error while keeping real markup shape
		html = html.replace('let isActive = false', 'let isActiv = false')
		const file = path.join(client, 'pages/demos/bindings.html')
		writeFileSync(file, html)

		let caught: unknown
		try {
			htmlCompileTry(file, () =>
				compileHtmlSourceForVite(
					html,
					file,
					{
						resolvedConfig: { root: dir } as any,
						resolvePath: (specifier: string) => {
							if (specifier.startsWith('@layouts/')) {
								return path.join(client, 'layouts', specifier.slice('@layouts/'.length))
							}
							return specifier
						},
						reactivity: true,
					},
					new Map()
				)
			)
		} catch (e) {
			caught = e
		}

		const merged = enrichDiagnostics(normalizeToDiagnostics(caught), {
			defaultFile: file,
		})
		const printed = formatDiagnosticsDevConsole(merged, { colors: false })
		const overlay = reportAeroFailure(
			caught,
			{ defaultFile: file, plugin: 'vite-plugin-aero-transform' },
			'vite-overlay'
		)

		expect((caught as any)?.line).toBeTypeOf('number')
		expect(merged[0]?.frame).toContain('class:is-active')
		expect(printed).toMatch(/bindings\.html:\d+:\d+/)
		expect(printed).toMatch(/>\s*\d+\s*\|/)
		expect(overlay.loc?.line).toBe(merged[0]?.span?.line)
		expect(overlay.frame).toContain('class:is-active')
	})
})
