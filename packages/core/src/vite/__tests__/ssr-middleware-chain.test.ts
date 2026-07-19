/**
 * Characterization tests for Aero SSR middleware chain short-circuits and rewrites.
 */

import { describe, expect, it } from 'vitest'
import { runAeroMiddlewareChain } from '../ssr-middleware-chain'

function mockRes() {
	return {
		statusCode: 200,
		headers: new Map<string, string>(),
		body: undefined as Buffer | undefined,
		setHeader(k: string, v: string) {
			this.headers.set(k, v)
		},
		end(body?: Buffer | string) {
			this.body = typeof body === 'string' ? Buffer.from(body) : body
		},
	}
}

describe('runAeroMiddlewareChain', () => {
	const baseCtx = {
		url: new URL('http://localhost/about'),
		request: new Request('http://localhost/about'),
		routePath: '/about',
		pageName: 'about',
	}
	const initial = {
		renderPageName: 'about',
		renderInput: { routePath: '/about' },
	}

	it('continues unchanged when middleware is empty', async () => {
		const res = mockRes()
		const out = await runAeroMiddlewareChain(undefined, baseCtx, initial, res as any)
		expect(out).toEqual({ kind: 'continue', ...initial })
		expect(res.body).toBeUndefined()
	})

	it('short-circuits on redirect', async () => {
		const res = mockRes()
		const out = await runAeroMiddlewareChain(
			[async () => ({ redirect: { url: '/elsewhere', status: 301 } })],
			baseCtx,
			initial,
			res as any
		)
		expect(out).toEqual({ kind: 'responded' })
		expect(res.statusCode).toBe(301)
		expect(res.headers.get('Location')).toBe('/elsewhere')
	})

	it('applies rewrite pageName and props', async () => {
		const res = mockRes()
		const out = await runAeroMiddlewareChain(
			[async () => ({ rewrite: { pageName: 'docs', props: { id: 1 } } })],
			baseCtx,
			initial,
			res as any
		)
		expect(out).toEqual({
			kind: 'continue',
			renderPageName: 'docs',
			renderInput: { routePath: '/about', props: { id: 1 } },
		})
		expect(res.body).toBeUndefined()
	})

	it('short-circuits on custom response', async () => {
		const res = mockRes()
		const out = await runAeroMiddlewareChain(
			[
				async () => ({
					response: new Response('ok', {
						status: 203,
						headers: { 'X-Aero': '1' },
					}),
				}),
			],
			baseCtx,
			initial,
			res as any
		)
		expect(out).toEqual({ kind: 'responded' })
		expect(res.statusCode).toBe(203)
		expect(res.headers.get('x-aero') ?? res.headers.get('X-Aero')).toBe('1')
		expect(res.body?.toString()).toBe('ok')
	})
})
