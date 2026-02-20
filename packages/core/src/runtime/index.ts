import type {
	AeroRenderInput,
	AeroRouteParams,
	AeroTemplateContext,
	MountOptions,
} from '../types'

interface PageMatch {
	module: any
	pageName: string
	params: AeroRouteParams
}

export class Aero {
	private globals: Record<string, any> = {}
	private pagesMap: Record<string, any> = {}
	mount?: (options?: MountOptions) => Promise<void>

	global(name: string, value: any) {
		this.globals[name] = value
	}

	registerPages(pages: Record<string, any>) {
		for (const [path, mod] of Object.entries(pages)) {
			const withoutExt = path.replace(/\.html$/, '').replace(/\\/g, '/')
			const key = withoutExt.includes('pages/')
				? withoutExt.split('pages/').pop()!
				: withoutExt.split('/').filter(Boolean).length > 1
					? withoutExt.split('/').filter(Boolean).join('/')
					: withoutExt.split('/').pop() || path
			this.pagesMap[key] = mod
			this.pagesMap[path] = mod
		}
	}

	private isRenderInput(value: any): value is AeroRenderInput {
		if (!value || typeof value !== 'object') return false
		return ['props', 'request', 'url', 'params', 'routePath'].some(key => key in value)
	}

	private normalizeRenderInput(input: any): AeroRenderInput {
		if (!input) return {}
		if (this.isRenderInput(input)) return input
		if (typeof input === 'object') return { props: input }
		return { props: {} }
	}

	private toRoutePath(pageName = 'index'): string {
		if (!pageName || pageName === 'index' || pageName === 'home') return '/'
		if (pageName.endsWith('/index')) {
			return '/' + pageName.slice(0, -'/index'.length)
		}
		return pageName.startsWith('/') ? pageName : '/' + pageName
	}

	private toURL(routePath: string, rawUrl?: URL | string): URL {
		if (rawUrl instanceof URL) return rawUrl
		if (typeof rawUrl === 'string' && rawUrl.length > 0) {
			return new URL(rawUrl, 'http://localhost')
		}
		return new URL(routePath, 'http://localhost')
	}

	private resolveDynamicPage(pageName: string): PageMatch | null {
		const requestedSegments = pageName.split('/').filter(Boolean)
		for (const [key, mod] of Object.entries(this.pagesMap)) {
			if (!key.includes('[') || !key.includes(']') || key.includes('.')) continue
			const keySegments = key.split('/').filter(Boolean)
			if (keySegments.length !== requestedSegments.length) continue

			const params: AeroRouteParams = {}
			let matched = true
			for (let i = 0; i < keySegments.length; i++) {
				const routeSegment = keySegments[i]
				const requestSegment = requestedSegments[i]
				const dynamicMatch = routeSegment.match(/^\[(.+)\]$/)

				if (dynamicMatch) {
					params[dynamicMatch[1]] = decodeURIComponent(requestSegment)
					continue
				}

				if (routeSegment !== requestSegment) {
					matched = false
					break
				}
			}

			if (matched) {
				return { module: mod, pageName: key, params }
			}
		}
		return null
	}

	private createContext(input: {
		props?: Record<string, any>
		slots?: Record<string, string>
		request?: Request
		url?: URL | string
		params?: AeroRouteParams
		routePath?: string
		styles?: Set<string>
	}): AeroTemplateContext {
		const routePath = input.routePath || '/'
		const url = this.toURL(routePath, input.url)
		const request = input.request || new Request(url.toString(), { method: 'GET' })
		const context = {
			...this.globals,
			props: input.props || {},
			slots: input.slots || {},
			request,
			url,
			params: input.params || {},
			styles: input.styles,
			renderComponent: this.renderComponent.bind(this),
		} as AeroTemplateContext

		return context
	}

	private paramsMatch(entryParams: AeroRouteParams, requestParams: AeroRouteParams): boolean {
		const entryKeys = Object.keys(entryParams)
		if (entryKeys.length !== Object.keys(requestParams).length) return false
		for (const key of entryKeys) {
			if (String(entryParams[key]) !== String(requestParams[key])) return false
		}
		return true
	}

	async render(component: any, input: any = {}) {
		const renderInput = this.normalizeRenderInput(input)
		const isRootRender = !renderInput.styles
		if (isRootRender) {
			renderInput.styles = new Set<string>()
		}

		let target = component
		let matchedPageName = typeof component === 'string' ? component : 'index'
		let dynamicParams: AeroRouteParams = {}
		if (typeof component === 'string') {
			target = this.pagesMap[component]

			// Fallback: If not found, try as directory index (e.g. /docs -> docs/index)
			if (!target) {
				target = this.pagesMap[`${component}/index`]
			}
			// Fallback: If index is not found, try home
			if (!target && component === 'index') {
				target = this.pagesMap['home']
			}

			if (!target) {
				const dynamicMatch =
					this.resolveDynamicPage(component) || this.resolveDynamicPage(`${component}/index`)
				if (dynamicMatch) {
					target = dynamicMatch.module
					matchedPageName = dynamicMatch.pageName
					dynamicParams = dynamicMatch.params
				}
			}

			// Fallback: trailing-slash URLs resolve to "foo/index" via
			// resolvePageName, but the actual page may be "foo" (static) or
			// matched by a dynamic pattern with fewer segments.  Strip the
			// "/index" suffix and retry the full lookup chain.
			if (!target && component.endsWith('/index')) {
				const stripped = component.slice(0, -'/index'.length)
				target = this.pagesMap[stripped]
				if (target) {
					matchedPageName = stripped
				}
				if (!target) {
					const dynamicMatch = this.resolveDynamicPage(stripped)
					if (dynamicMatch) {
						target = dynamicMatch.module
						matchedPageName = dynamicMatch.pageName
						dynamicParams = dynamicMatch.params
					}
				}
			}
		}

		if (!target) {
			return null
		}

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
			slots: {},
			request: renderInput.request,
			url: renderInput.url,
			params: { ...dynamicParams, ...(renderInput.params || {}) },
			routePath,
			styles: renderInput.styles,
		})

		// Handle module objects
		let renderFn = target
		if (target.default) renderFn = target.default

		if (typeof renderFn === 'function') {
			let html = await renderFn(context)
			if (isRootRender && context.styles && context.styles.size > 0) {
				const stylesHtml = Array.from(context.styles).join('\n')
				if (html.includes('</head>')) {
					html = html.replace('</head>', `\n${stylesHtml}\n</head>`)
				} else if (html.includes('<body')) {
					html = html.replace(/(<body[^>]*>)/i, `<head>\n${stylesHtml}\n</head>\n$1`)
				} else {
					html = `${stylesHtml}\n${html}`
				}
			}
			return html
		}

		return ''
	}

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
