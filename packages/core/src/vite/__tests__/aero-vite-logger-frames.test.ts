import { describe, expect, it, vi } from 'vitest'
import {
	AERO_DIAGNOSTICS_ERROR_PROP,
	createDiagnosticLogGate,
	type AeroDiagnostic,
} from '@aero-js/diagnostics'
import { wrapAeroViteLogger } from '../aero-vite-logger'

describe('aero vite logger code frames', () => {
	it('keeps Vite frames when loc was stripped (TransformPluginContext remap)', () => {
		const gate = createDiagnosticLogGate()
		const baseError = vi.fn()
		const wrapped = wrapAeroViteLogger({ error: baseError, hasColors: false } as any, gate)
		const err = Object.assign(
			new Error('Reactive class binding `class:is-active` must reference a declared state variable.'),
			{
				id: '/proj/client/pages/demos/bindings.html',
				plugin: 'vite-plugin-aero-transform',
				frame:
					'> 46 | <div class:is-active="{ isActive }" class="card text-center">\n     |      ^',
			}
		)

		wrapped.error(`Internal server error: ${err.message}`, { error: err })

		const printed = String(baseError.mock.calls[0]![0])
		expect(printed).toContain('class:is-active')
		expect(printed).toContain('>')
		expect(printed).toContain('class="card text-center"')
	})

	it('prefers attached Aero diagnostics over Vite-corrupted loc', () => {
		const gate = createDiagnosticLogGate()
		const baseError = vi.fn()
		const wrapped = wrapAeroViteLogger({ error: baseError, hasColors: false } as any, gate)
		const diagnostics: AeroDiagnostic[] = [
			{
				code: 'AERO_COMPILE',
				severity: 'error',
				message:
					'Reactive class binding `class:is-active` must reference a declared state variable.',
				file: '/proj/client/pages/demos/bindings.html',
				span: {
					file: '/proj/client/pages/demos/bindings.html',
					line: 46,
					column: 9,
				},
				frame:
					'> 46 | <div class:is-active="{ isActive }" class="card text-center">\n     |          ^',
			},
		]
		const err = Object.assign(new Error(diagnostics[0]!.message), {
			id: '/proj/client/pages/demos/bindings.html',
			plugin: 'vite-plugin-aero-transform',
			// Vite sourcemap remap can leave a useless loc
			loc: { file: 'bindings.html', line: null, column: null },
			[AERO_DIAGNOSTICS_ERROR_PROP]: diagnostics,
		})

		wrapped.error(`Internal server error: ${err.message}`, { error: err })

		const printed = String(baseError.mock.calls[0]![0])
		expect(printed).toContain('bindings.html:46:9')
		expect(printed).toContain('class:is-active')
		expect(printed).toMatch(/>\s*46\s*\|/)
	})
})
