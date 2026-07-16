/**
 * Dev console formatter: timestamp + [aero] Error + loc + frame (no banners / Hint).
 */

import { describe, expect, it } from 'vitest'
import { formatDiagnosticsDevConsole } from '../render/dev-console'

const fixed = new Date(2026, 6, 16, 14, 36, 27)

describe('formatDiagnosticsDevConsole', () => {
	it('emits timestamp, error, loc on one line, then frame without banners or Hint', () => {
		const text = formatDiagnosticsDevConsole(
			[
				{
					code: 'AERO_COMPILE',
					severity: 'error',
					message: 'Missing opening {',
					file: 'client/assets/styles/global.css',
					span: { file: 'client/assets/styles/global.css', line: 21, column: 1 },
					frame: '> 21 | }\n     | ^',
					hint: 'while rendering client/pages/index.html',
				},
			],
			{ colors: false, now: fixed }
		)
		expect(text).toMatchInlineSnapshot(`
			"2:36:27 PM [aero] Error: Missing opening { client/assets/styles/global.css:21:1

			> 21 | }
			     | ^
			"
		`)
		expect(text).not.toContain('Hint')
		expect(text).not.toContain('while rendering')
		expect(text).not.toContain('―')
		expect(text).not.toContain('File:')
		expect(text).not.toContain('\u001b]8;;')
	})

	it('colors timestamp, error, loc, and frame when colors are enabled', () => {
		const text = formatDiagnosticsDevConsole(
			[
				{
					code: 'AERO_COMPILE',
					severity: 'error',
					message: 'boom',
					file: 'a.html',
					span: { file: 'a.html', line: 1, column: 0 },
					frame: '> 1 | x',
				},
			],
			{ colors: true, now: fixed }
		)
		expect(text).toContain('\x1b[90m') // gray timestamp
		expect(text).toContain('\x1b[31m') // red error
		expect(text).toContain('\x1b[33m') // yellow frame
		expect(text).not.toContain('\u001b]8;;')
	})
})
