/**
 * Run Aero middleware handlers for a dev SSR request.
 */

import type { AeroMiddleware, AeroMiddlewareResult, AeroRenderInput } from '../types'

export type AeroMiddlewareChainOutcome =
	| { kind: 'responded' }
	| { kind: 'continue'; renderPageName: string; renderInput: AeroRenderInput }

/**
 * Apply middleware handlers until one responds (redirect/response) or all complete.
 *
 * @param middleware - Handlers from Aero options (may be empty/undefined).
 * @param ctx - Request context shared with each handler.
 * @param initial - Page name and render input before middleware rewrites.
 * @param res - Node response used for redirect/custom response short-circuits.
 */
export async function runAeroMiddlewareChain(
	middleware: AeroMiddleware[] | undefined,
	ctx: {
		url: URL
		request: Request
		routePath: string
		pageName: string
		site?: string
	},
	initial: { renderPageName: string; renderInput: AeroRenderInput },
	res: import('node:http').ServerResponse
): Promise<AeroMiddlewareChainOutcome> {
	let renderPageName = initial.renderPageName
	let renderInput = initial.renderInput

	if (!middleware?.length) {
		return { kind: 'continue', renderPageName, renderInput }
	}

	for (const handler of middleware) {
		const result: AeroMiddlewareResult = await Promise.resolve(handler(ctx))
		if (result && 'redirect' in result) {
			res.statusCode = result.redirect.status ?? 302
			res.setHeader('Location', result.redirect.url)
			res.end()
			return { kind: 'responded' }
		}
		if (result && 'response' in result) {
			res.statusCode = result.response.status
			result.response.headers.forEach((v: string, k: string) => res.setHeader(k, v))
			const body = await result.response.arrayBuffer()
			res.end(Buffer.from(body))
			return { kind: 'responded' }
		}
		if (result && 'rewrite' in result) {
			if (result.rewrite.pageName !== undefined) {
				renderPageName = result.rewrite.pageName
			}
			const { pageName: _pn, ...rest } = result.rewrite
			renderInput = { ...renderInput, ...rest }
		}
	}

	return { kind: 'continue', renderPageName, renderInput }
}
