/**
 * Dev SSR middleware: HTML requests → middleware chain → runtime render → error HTML.
 */

import type { AeroOptions, AeroRenderInput } from '../types'
import type { ViteDevServer } from 'vite'
import { isRunnableDevEnvironment } from 'vite'
import path from 'node:path'
import { resolvePageName } from '../utils/routing'
import { addDoctype } from './rewrite'
import { RUNTIME_INSTANCE_MODULE_ID, resolveDirs } from './defaults'
import { runAeroMiddlewareChain } from './ssr-middleware-chain'
import { renderDevSsrErrorResponse } from './ssr-dev-error-response'

/** Subset of Aero plugin state needed for SSR (avoids circular import from `index.ts`). */
interface AeroSsrMiddlewareState {
	config: { root: string } | null
	dirs: ReturnType<typeof resolveDirs>
	apiPrefix: string
	options: AeroOptions
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

		const chain = await runAeroMiddlewareChain(
			state.options.middleware,
			{
				url: requestUrl,
				request,
				routePath: pathname,
				pageName,
				site: state.options.site?.url,
			},
			{
				renderPageName: pageName,
				renderInput: {
					url: requestUrl,
					request,
					routePath: pathname,
					site: state.options.site?.url,
				} satisfies AeroRenderInput,
			},
			res
		)
		if (chain.kind === 'responded') return

		const { renderPageName, renderInput } = chain
		renderPageNameForDiag = renderPageName

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
		await renderDevSsrErrorResponse({
			err,
			res,
			server,
			root,
			clientDir: state.dirs.client,
			pageTemplateHint,
		})
	}
}
