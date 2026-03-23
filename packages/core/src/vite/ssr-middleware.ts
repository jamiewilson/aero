/**
 * Dev SSR middleware: HTML requests → middleware chain → runtime render → error HTML.
 */

import type { AeroMiddlewareResult, AeroOptions, AeroRenderInput } from '../types'
import type { ViteDevServer } from 'vite'
import { isRunnableDevEnvironment } from 'vite'
import path from 'node:path'
import {
	AERO_DIAGNOSTICS_HTTP_HEADER,
	type AeroDiagnostic,
	buildDevSsrErrorHtml,
	encodeDiagnosticsHeaderValue,
	enrichDiagnosticsWithSourceFrames,
	formatDiagnosticsTerminal,
	unknownToAeroDiagnostics,
} from '@aero-js/diagnostics'
import { resolvePageName } from '../utils/routing'
import { addDoctype } from './build'
import { RUNTIME_INSTANCE_MODULE_ID, resolveDirs } from './defaults'

/** Subset of Aero plugin state needed for SSR (avoids circular import from `index.ts`). */
export interface AeroSsrMiddlewareState {
	config: { root: string } | null
	dirs: ReturnType<typeof resolveDirs>
	apiPrefix: string
	options: AeroOptions
}

function isDebugEnabled(): boolean {
	const v = process.env.AERO_LOG
	return v === 'debug' || (typeof v === 'string' && v.split(/[\s,]+/).includes('debug'))
}

const ssrMetricsByCode = new Map<string, number>()
let ssrDiagnosticsTotal = 0

function recordSsrDiagnosticsMetrics(diagnostics: readonly AeroDiagnostic[]): void {
	if (diagnostics.length === 0) return
	ssrDiagnosticsTotal += diagnostics.length
	for (const d of diagnostics) {
		ssrMetricsByCode.set(d.code, (ssrMetricsByCode.get(d.code) ?? 0) + 1)
	}
	if (isDebugEnabled()) {
		console.error(
			`[aero] metrics[dev-ssr] +${diagnostics.length} diagnostics (total=${ssrDiagnosticsTotal}) ` +
				`codes=${diagnostics.map(d => d.code).join(',')}`
		)
	}
}

/**
 * Handle a single dev-server request that may be an HTML page render (GET + Accept: text/html).
 */
export async function handleSsrRequest(
	req: import('node:http').IncomingMessage,
	res: import('node:http').ServerResponse,
	next: (err?: unknown) => void,
	state: AeroSsrMiddlewareState,
	server: ViteDevServer
): Promise<void> {
	if (!req.url) return next()
	if (req.method && req.method.toUpperCase() !== 'GET') return next()

	const acceptsHtml = req.headers.accept?.includes('text/html')
	if (!acceptsHtml) return next()

	const pathname = req.url.split('?')[0] || '/'
	if (
		pathname.startsWith(state.apiPrefix) ||
		pathname.startsWith('/@fs') ||
		pathname.startsWith('/@id')
	) {
		return next()
	}

	const ext = path.extname(pathname)
	if (ext && ext !== '.html') return next()

	// Apply config redirects first (exact path match)
	const redirects = state.options.redirects
	if (redirects?.length) {
		for (const rule of redirects) {
			if (pathname === rule.from) {
				res.statusCode = rule.status ?? 302
				res.setHeader('Location', rule.to)
				res.end()
				return
			}
		}
	}

	let renderPageNameForDiag = resolvePageName(req.url)
	try {
		const pageName = resolvePageName(req.url)
		renderPageNameForDiag = pageName
		const ssrEnv = server.environments.ssr
		if (!isRunnableDevEnvironment(ssrEnv)) {
			throw new Error('[aero] SSR environment must be runnable')
		}
		const mod = await ssrEnv.runner.import(RUNTIME_INSTANCE_MODULE_ID)

		const requestUrl = new URL(req.url, 'http://localhost')
		const requestHeaders = new Headers()
		for (const [name, value] of Object.entries(req.headers)) {
			if (value === undefined) continue
			if (Array.isArray(value)) {
				for (const item of value) requestHeaders.append(name, item)
				continue
			}
			requestHeaders.set(name, value)
		}

		const request = new Request(requestUrl.toString(), {
			method: req.method || 'GET',
			headers: requestHeaders,
		})

		let renderPageName = pageName
		let renderInput: AeroRenderInput = {
			url: requestUrl,
			request,
			routePath: pathname,
			site: state.options.site?.url,
		}

		// Run middleware (redirects, rewrites, custom response)
		const middleware = state.options.middleware
		if (middleware?.length) {
			const ctx = {
				url: requestUrl,
				request,
				routePath: pathname,
				pageName,
				site: state.options.site?.url,
			}
			for (const handler of middleware) {
				const result: AeroMiddlewareResult = await Promise.resolve(handler(ctx))
				if (result && 'redirect' in result) {
					res.statusCode = result.redirect.status ?? 302
					res.setHeader('Location', result.redirect.url)
					res.end()
					return
				}
				if (result && 'response' in result) {
					res.statusCode = result.response.status
					result.response.headers.forEach((v: string, k: string) => res.setHeader(k, v))
					const body = await result.response.arrayBuffer()
					res.end(Buffer.from(body))
					return
				}
				if (result && 'rewrite' in result) {
					if (result.rewrite.pageName !== undefined) {
						renderPageName = result.rewrite.pageName
						renderPageNameForDiag = renderPageName
					}
					const { pageName: _pn, ...rest } = result.rewrite
					renderInput = { ...renderInput, ...rest }
				}
			}
		}

		let rendered = await mod.aero.render(renderPageName, renderInput)

		if (rendered === null) {
			res.statusCode = 404
			rendered = await mod.aero.render('404', renderInput)
		}

		if (rendered === null) {
			res.statusCode = 404
			res.setHeader('Content-Type', 'text/html; charset=utf-8')
			res.end('<h1>404 — Not Found</h1>')
			return
		}

		rendered = addDoctype(rendered)

		const transformed = await server.transformIndexHtml(req.url, rendered)
		res.setHeader('Content-Type', 'text/html; charset=utf-8')
		res.end(transformed)
	} catch (err) {
		const root = state.config?.root
		const pageTemplateHint =
			root && renderPageNameForDiag
				? path.join(root, state.dirs.client, 'pages', `${renderPageNameForDiag}.html`)
				: undefined
		const diagnostics = enrichDiagnosticsWithSourceFrames(
			unknownToAeroDiagnostics(err, pageTemplateHint ? { file: pageTemplateHint } : {})
		)
		recordSsrDiagnosticsMetrics(diagnostics)
		server.config.logger.error('\n' + formatDiagnosticsTerminal(diagnostics) + '\n')
		const devDetails = server.config.mode === 'development'
		if (devDetails) {
			res.statusCode = 500
			res.setHeader('Content-Type', 'text/html; charset=utf-8')
			res.setHeader(AERO_DIAGNOSTICS_HTTP_HEADER, encodeDiagnosticsHeaderValue(diagnostics))
			res.end(buildDevSsrErrorHtml(diagnostics))
			return
		}
		res.statusCode = 500
		res.setHeader('Content-Type', 'text/html; charset=utf-8')
		res.end(
			'<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body><h1>Internal Server Error</h1></body></html>'
		)
	}
}
