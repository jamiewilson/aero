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
			renderComponent: this.renderComponent.bind(this),
		} as AeroTemplateContext

		return context
	}

	async render(component: any, input: any = {}) {
		const renderInput = this.normalizeRenderInput(input)

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
		}

		if (!target) {
			return `Page not found: ${component}`
		}

		const routePath = renderInput.routePath || this.toRoutePath(matchedPageName)
		const context = this.createContext({
			props: renderInput.props || {},
			slots: {},
			request: renderInput.request,
			url: renderInput.url,
			params: { ...dynamicParams, ...(renderInput.params || {}) },
			routePath,
		})

		// Handle lazy-loaded modules (Vite import.meta.glob without eager)
		// Lazy loaders are () => import(...), while render functions are aero => ...
		if (typeof target === 'function' && target.length === 0) {
			target = await target()
		}

		// Handle module objects
		if (target.default) target = target.default

		if (typeof target === 'function') {
			return await target(context)
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
