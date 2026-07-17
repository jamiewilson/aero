/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ViteOverlayErrorPayload } from '@aero-js/diagnostics/browser'

const showAeroViteErrorOverlay = vi.fn(async (_err: ViteOverlayErrorPayload) => {})
const clearAeroViteErrorOverlay = vi.fn()

vi.mock('../vite-error-overlay', () => ({
	showAeroViteErrorOverlay: (err: ViteOverlayErrorPayload) => showAeroViteErrorOverlay(err),
	clearAeroViteErrorOverlay: () => clearAeroViteErrorOverlay(),
}))

import { renderPage } from '../client'
import { encodeDiagnosticsHeaderValue } from '@aero-js/diagnostics'

afterEach(() => {
	vi.unstubAllGlobals()
	showAeroViteErrorOverlay.mockClear()
	clearAeroViteErrorOverlay.mockClear()
})

beforeEach(() => {
	document.body.innerHTML = ''
	document.body.removeAttribute('id')
	document.body.className = ''
})

describe('renderPage', () => {
	it('syncs body class attributes when mount target is body', async () => {
		document.body.id = 'custom-target'
		document.body.className = ''
		document.body.innerHTML = '<div>old</div>'

		const html =
			'<!DOCTYPE html><html lang="en"><head></head><body id="custom-target" class="bg-gray-900 text-white"><div>new</div></body></html>'

		if (import.meta.hot) {
			vi.stubGlobal(
				'fetch',
				vi.fn(async () => ({
					ok: true,
					status: 200,
					text: async () => html,
					headers: { get: () => null },
				}))
			)
		}

		await renderPage(document.body, async () => html)

		expect(document.body.className).toBe('bg-gray-900 text-white')
		expect(document.body.innerHTML).toContain('new')
	})

	it('removes body class attributes when source omits class', async () => {
		document.body.id = 'custom-target'
		document.body.className = 'bg-gray-900 text-white'
		document.body.innerHTML = '<div>old</div>'

		const html =
			'<!DOCTYPE html><html lang="en"><head></head><body id="custom-target"><div>new</div></body></html>'

		if (import.meta.hot) {
			vi.stubGlobal(
				'fetch',
				vi.fn(async () => ({
					ok: true,
					status: 200,
					text: async () => html,
					headers: { get: () => null },
				}))
			)
		}

		await renderPage(document.body, async () => html)

		expect(document.body.className).toBe('')
	})

	it('preserves client-set html attributes such as data-theme during shell sync', async () => {
		document.documentElement.setAttribute('data-theme', 'dark')
		document.body.id = 'custom-target'
		document.body.innerHTML = '<div>old</div>'

		const html =
			'<!DOCTYPE html><html lang="en"><head></head><body id="custom-target"><div>new</div></body></html>'

		if (import.meta.hot) {
			vi.stubGlobal(
				'fetch',
				vi.fn(async () => ({
					ok: true,
					status: 200,
					text: async () => html,
					headers: { get: () => null },
				}))
			)
		}

		await renderPage(document.body, async () => html)

		expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
		expect(document.documentElement.getAttribute('lang')).toBe('en')
	})

	it('mounts Vite ErrorOverlay for overlay bootstrap SSR errors without replacing page', async () => {
		document.body.id = 'app'
		document.body.innerHTML = '<div id="page">existing</div>'

		const diagnostics = [
			{
				code: 'AERO_INTERNAL' as const,
				severity: 'error' as const,
				message: 'numbers is not defined',
				file: 'client/pages/demos/iterables.html',
				span: {
					file: 'client/pages/demos/iterables.html',
					line: 7,
					column: 20,
				},
			},
		]
		const bootstrap =
			'<!doctype html><html data-aero-overlay-bootstrap><body><p>Loading overlay...</p></body></html>'
		const header = encodeDiagnosticsHeaderValue(diagnostics)

		if (!import.meta.hot) {
			throw new Error('expected import.meta.hot in client HMR tests')
		}

		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: false,
				status: 500,
				text: async () => bootstrap,
				headers: { get: (name: string) => (name === 'x-aero-diagnostics' ? header : null) },
			}))
		)

		await renderPage(document.body, async () => null)

		expect(document.body.innerHTML).toContain('existing')
		expect(showAeroViteErrorOverlay).toHaveBeenCalledOnce()
		expect(showAeroViteErrorOverlay.mock.calls[0]![0]).toMatchObject({
			message: 'numbers is not defined',
			plugin: 'vite-plugin-aero-ssr',
			id: 'client/pages/demos/iterables.html',
		})
	})

	it('falls back to inline diagnostics when Vite ErrorOverlay cannot mount', async () => {
		document.body.id = 'app'
		document.body.innerHTML = '<div id="page">existing</div>'
		showAeroViteErrorOverlay.mockRejectedValueOnce(new Error('overlay unavailable'))

		const diagnostics = [
			{
				code: 'AERO_INTERNAL' as const,
				severity: 'error' as const,
				message: 'numbers is not defined',
				file: 'client/pages/demos/iterables.html',
			},
		]
		const bootstrap =
			'<!doctype html><html data-aero-overlay-bootstrap><body><p>Loading overlay...</p></body></html>'
		const header = encodeDiagnosticsHeaderValue(diagnostics)

		if (!import.meta.hot) {
			throw new Error('expected import.meta.hot in client HMR tests')
		}

		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: false,
				status: 500,
				text: async () => bootstrap,
				headers: { get: (name: string) => (name === 'x-aero-diagnostics' ? header : null) },
			}))
		)

		await renderPage(document.body, async () => null)

		expect(document.body.textContent).toContain('Error rendering page')
		expect(document.body.textContent).toContain('numbers is not defined')
	})

	it('clears Vite ErrorOverlay after a successful HMR fetch', async () => {
		document.body.id = 'app'
		document.body.innerHTML = '<div>old</div>'
		const html =
			'<!DOCTYPE html><html lang="en"><head></head><body id="app"><div>fixed</div></body></html>'

		if (!import.meta.hot) {
			throw new Error('expected import.meta.hot in client HMR tests')
		}

		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				status: 200,
				text: async () => html,
				headers: { get: () => null },
			}))
		)

		await renderPage(document.body, async () => html)

		expect(clearAeroViteErrorOverlay).toHaveBeenCalledOnce()
		expect(document.body.innerHTML).toContain('fixed')
	})
})
