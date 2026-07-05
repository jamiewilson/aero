/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderPage } from '../client'

afterEach(() => {
	vi.unstubAllGlobals()
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
})
