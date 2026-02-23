/**
 * Aero runtime: page registration, route resolution, and HTML rendering.
 *
 * @remarks
 * The `Aero` class holds globals and a map of page/layout modules. `render()` resolves a page name
 * (e.g. from `resolvePageName`), builds template context, and invokes the compiled render function.
 * `mount` is optionally set by the client entry (`core/src/index.ts`).
 */

import type {
	AeroRenderInput,
	AeroRouteParams,
	AeroTemplateContext,
	MountOptions,
} from '../types'
import { pagePathToKey, resolvePageTarget } from '../utils/routing'

export class Aero {
	/** Global values merged into template context (e.g. from content modules). */
	private globals: Record<string, any> = {}
	/** Map from page name (or path) to module. Keys include both canonical name and full path for lookup. */
	private pagesMap: Record<string, any> = {}
	/** Set by client entry when running in the browser; used to attach the app to a DOM root. */
	mount?: (options?: MountOptions) => Promise<void>

	/**
	 * Register a global value available in all templates as `name`.
	 *
	 * @param name - Key used in templates (e.g. `site`).
	 * @param value - Any value (object, string, etc.).
	 */
	global(name: string, value: any) {
		this.globals[name] = value
	}

	/**
	 * Register page/layout modules from a Vite glob (e.g. `import.meta.glob('@pages/**\/*.html')`).
	 * Derives a lookup key from each path via pagePathToKey; also stores by full path for resolution.
	 *
	 * @param pages - Record of resolved path → module (default export is the render function).
	 */
	registerPages(pages: Record<string, any>) {
		for (const [path, mod] of Object.entries(pages)) {
			const key = pagePathToKey(path)
			this.pagesMap[key] = mod
			this.pagesMap[path] = mod
		}
	}

	/** Type guard: true if value looks like an `AeroRenderInput` (has at least one of props, slots, request, url, params, routePath). */
	private isRenderInput(value: any): value is AeroRenderInput {
		if (!value || typeof value !== 'object') return false
		return ['props', 'slots', 'request', 'url', 'params', 'routePath'].some(key => key in value)
	}

	/** Coerce various call signatures into a single `AeroRenderInput` (e.g. plain object → `{ props }`). */
	private normalizeRenderInput(input: any): AeroRenderInput {
		if (!input) return {}
		if (this.isRenderInput(input)) return input
		if (typeof input === 'object') return { props: input }
		return { props: {} }
	}

	/** Convert a page name to a route path (e.g. `index` → `'/'`, `about` → `'/about'`). */
	private toRoutePath(pageName = 'index'): string {
		if (!pageName || pageName === 'index' || pageName === 'home') return '/'
		if (pageName.endsWith('/index')) {
			return '/' + pageName.slice(0, -'/index'.length)
		}
		return pageName.startsWith('/') ? pageName : '/' + pageName
	}

	/** Build a URL from route path and optional raw URL. Uses `http://localhost` as base when only a path is given. */
	private toURL(routePath: string, rawUrl?: URL | string): URL {
		if (rawUrl instanceof URL) return rawUrl
		if (typeof rawUrl === 'string' && rawUrl.length > 0) {
			return new URL(rawUrl, 'http://localhost')
		}
		return new URL(routePath, 'http://localhost')
	}

	/** Build template context: globals, props, slots, request, url, params, and `renderComponent` / `nextPassDataId`. */
	private createContext(input: {
		props?: Record<string, any>
		slots?: Record<string, string>
		request?: Request
		url?: URL | string
		params?: AeroRouteParams
		routePath?: string
		styles?: Set<string>
		scripts?: Set<string>
		headScripts?: Set<string>
	}): AeroTemplateContext {
		const routePath = input.routePath || '/'
		const url = this.toURL(routePath, input.url)
		const request = input.request || new Request(url.toString(), { method: 'GET' })
		let _passDataId = 0
		const context = {
			...this.globals,
			props: input.props || {},
			slots: input.slots || {},
			request,
			url,
			params: input.params || {},
			styles: input.styles,
			scripts: input.scripts,
			headScripts: input.headScripts,
			nextPassDataId: () => `__aero_${_passDataId++}`,
			renderComponent: this.renderComponent.bind(this),
		} as AeroTemplateContext

		return context
	}

	/** True if entry params and request params have the same keys and stringified values. */
	private paramsMatch(entryParams: AeroRouteParams, requestParams: AeroRouteParams): boolean {
		const entryKeys = Object.keys(entryParams)
		if (entryKeys.length !== Object.keys(requestParams).length) return false
		for (const key of entryKeys) {
			if (String(entryParams[key]) !== String(requestParams[key])) return false
		}
		return true
	}

	/**
	 * Render a page or layout to HTML.
	 *
	 * @remarks
	 * Resolves `component` (page name string or module) via `pagesMap`, with fallbacks: directory index
	 * (`foo` → `foo/index`), `index` → `home`, dynamic routes, and trailing-slash stripping. If the module
	 * exports `getStaticPaths` and no props are provided, finds the matching static path and uses its props.
	 * For root-level renders, injects accumulated styles and scripts into the document and fixes content
	 * that ends up after `</html>` when using layouts (moves it into `</body>`).
	 *
	 * @param component - Page name (e.g. `'index'`, `'about'`) or the module object.
	 * @param input - Render input (props, request, url, params, etc.). Can be a plain object (treated as props).
	 * @returns HTML string, or `null` if the page is not found or no static path match.
	 */
	async render(component: any, input: any = {}) {
		const renderInput = this.normalizeRenderInput(input)
		const isRootRender = !renderInput.styles
		if (isRootRender) {
			renderInput.styles = new Set<string>()
			renderInput.scripts = new Set<string>()
			renderInput.headScripts = new Set<string>()
		}

		const resolved = resolvePageTarget(component, this.pagesMap)
		if (!resolved) return null

		let target = resolved.module
		const matchedPageName = resolved.pageName
		const dynamicParams = resolved.params

		// Handle lazy-loaded modules (Vite import.meta.glob without eager)
		// Lazy loaders are () => import(...), while render functions are aero => ...
		if (typeof target === 'function' && target.length === 0) {
			target = await target()
		}

		// Unified Data Fetching: if the module exports getStaticPaths and we don't
		// have props (Dev mode), execute it to find the matching entry and props.
		if (
			typeof target.getStaticPaths === 'function' &&
			Object.keys(renderInput.props || {}).length === 0
		) {
			const staticPaths: any[] = await target.getStaticPaths()
			const combinedParams = { ...dynamicParams, ...(renderInput.params || {}) }

			const match = staticPaths.find(entry => this.paramsMatch(entry.params, combinedParams))

			if (!match) {
				console.warn(
					`[aero] 404: Route params ${JSON.stringify(combinedParams)} ` +
						`not found in getStaticPaths for ${matchedPageName}`,
				)
				return null
			}

			if (match.props) {
				renderInput.props = match.props
			}
		}

		const routePath = renderInput.routePath || this.toRoutePath(matchedPageName)
		const context = this.createContext({
			props: renderInput.props || {},
			slots: renderInput.slots || {},
			request: renderInput.request,
			url: renderInput.url,
			params: { ...dynamicParams, ...(renderInput.params || {}) },
			routePath,
			styles: renderInput.styles,
			scripts: renderInput.scripts,
			headScripts: renderInput.headScripts,
		})

		// Handle module objects
		let renderFn = target
		if (target.default) renderFn = target.default

		if (typeof renderFn === 'function') {
			let html = await renderFn(context)
			if (isRootRender) {
				// Layout returns full document; page's trailing nodes (e.g. inline scripts) can end up after </html>.
				// Move that content into the body so it isn't lost.
				if (html.includes('</html>')) {
					const afterHtml = html.split('</html>')[1]?.trim()
					if (afterHtml && html.includes('</body>')) {
						html = html.split('</html>')[0] + '</html>'
						html = html.replace('</body>', `\n${afterHtml}\n</body>`)
					}
				}

				let headInjections = ''
				if (context.styles && context.styles.size > 0) {
					headInjections += Array.from(context.styles).join('\n') + '\n'
				}
				if (context.headScripts && context.headScripts.size > 0) {
					headInjections += Array.from(context.headScripts).join('\n') + '\n'
				}

				if (headInjections) {
					if (html.includes('</head>')) {
						html = html.replace('</head>', `\n${headInjections}</head>`)
					} else if (html.includes('<body')) {
						html = html.replace(/(<body[^>]*>)/i, `<head>\n${headInjections}</head>\n$1`)
					} else {
						html = `${headInjections}${html}`
					}
				}

				if (context.scripts && context.scripts.size > 0) {
					const scriptsHtml = Array.from(context.scripts).join('\n')
					if (html.includes('</body>')) {
						html = html.replace('</body>', `\n${scriptsHtml}\n</body>`)
					} else {
						html = `${html}\n${scriptsHtml}`
					}
				}
			}
			return html
		}

		return ''
	}

	/**
	 * Render a child component (layout or component) with the given props and slots.
	 * Used by compiled templates via context.renderComponent.
	 *
	 * @param component - Render function or module with `default` render function.
	 * @param props - Props object for the component.
	 * @param slots - Named slot content (key → HTML string).
	 * @param input - Optional request/url/params for context; `headScripts` is not passed through.
	 * @returns HTML string from the component's render function, or empty string if not invokable.
	 */
	async renderComponent(
		component: any,
		props: any = {},
		slots: Record<string, string> = {},
		input: AeroRenderInput = {},
	) {
		const context = this.createContext({
			props,
			slots,
			request: input.request,
			url: input.url,
			params: input.params,
			routePath: input.routePath || '/',
			styles: input.styles,
			scripts: input.scripts,
		})

		if (typeof component === 'function') {
			return await component(context)
		}

		// If it's the module object itself
		if (component && typeof component.default === 'function') {
			return await component.default(context)
		}

		return ''
	}
}
