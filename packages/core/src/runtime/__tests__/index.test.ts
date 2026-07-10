/**
 * Unit tests for the Aero runtime (index.ts): globals, registerPages, toRoutePath,
 * render, and renderComponent. Page resolution (resolveDynamicPage, resolvePageTarget) is
 * tested in utils/__tests__/routing.test.ts. Uses (aero as any) to assert internal
 * state where the public API does not expose it.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { resolveDynamicPage } from '../../utils/routing'
import { Aero } from '../index'

describe('Aero class', () => {
	let aero: Aero

	beforeEach(() => {
		aero = new Aero()
	})

	describe('global', () => {
		it('should set a global value', () => {
			aero.global('site', { title: 'Test' })
			expect((aero as any).globals.site).toEqual({ title: 'Test' })
		})

		it('should overwrite existing global', () => {
			aero.global('foo', 'bar')
			aero.global('foo', 'baz')
			expect((aero as any).globals.foo).toBe('baz')
		})
	})

	/** Keys are derived from path: segment after "pages/" or last segment; stored with and without .html. */
	describe('registerPages', () => {
		it('should register pages with key normalization', () => {
			const pages = {
				'pages/index.html': { default: () => 'home' },
				'pages/about.html': { default: () => 'about' },
			}
			aero.registerPages(pages)

			const pagesMap = (aero as any).pagesMap
			expect(pagesMap['index']).toBeDefined()
			expect(pagesMap['about']).toBeDefined()
		})

		it('should handle both .html and non-.html keys', () => {
			const pages = {
				'pages/contact': { default: () => 'contact' },
				'pages/contact.html': { default: () => 'contact' },
			}
			aero.registerPages(pages)

			const pagesMap = (aero as any).pagesMap
			expect(pagesMap['contact']).toBeDefined()
		})
	})

	describe('toRoutePath', () => {
		it('should convert index to root path', () => {
			expect((aero as any).toRoutePath('index')).toBe('/')
		})

		it('should convert home to root path', () => {
			expect((aero as any).toRoutePath('home')).toBe('/')
		})

		it('should convert empty to root path', () => {
			expect((aero as any).toRoutePath('')).toBe('/')
		})

		it('should preserve paths starting with /', () => {
			expect((aero as any).toRoutePath('/blog')).toBe('/blog')
		})

		it('should strip /index suffix', () => {
			expect((aero as any).toRoutePath('blog/index')).toBe('/blog')
		})

		it('should add leading slash', () => {
			expect((aero as any).toRoutePath('about')).toBe('/about')
		})
	})

	/** Matches path segments to [param] segments; first match wins. Uses shared resolveDynamicPage with pagesMap. */
	describe('resolveDynamicPage (via routing)', () => {
		beforeEach(() => {
			aero = new Aero()
			aero.registerPages({
				'pages/[slug].html': { default: () => 'dynamic' },
				'pages/blog/[id].html': { default: () => 'blog' },
			})
		})

		it('should resolve dynamic page with single param', () => {
			const result = resolveDynamicPage('hello', (aero as any).pagesMap)
			expect(result).not.toBeNull()
			expect(result!.params.slug).toBe('hello')
		})

		it('should resolve dynamic page with nested param', () => {
			const result = resolveDynamicPage('blog/123', (aero as any).pagesMap)
			expect(result).not.toBeNull()
			expect(result!.params.id).toBe('123')
		})

		it('should resolve dynamic page for any path (wildcard behavior)', () => {
			const result = resolveDynamicPage('static-page', (aero as any).pagesMap)
			expect(result).not.toBeNull()
			expect(result!.params.slug).toBe('static-page')
		})
	})

	describe('render', () => {
		it('should return null for non-existent page', async () => {
			const result = await aero.render('nonexistent')
			expect(result).toBeNull()
		})

		it('should render registered page', async () => {
			aero.registerPages({
				'pages/index.html': { default: () => '<div>Hello</div>' },
			})

			const result = await aero.render('index')
			expect(result).toBe('<div>Hello</div>')
		})

		it('should render with props', async () => {
			aero.registerPages({
				'pages/index.html': {
					default: (ctx: any) => `<div>${ctx.props.title}</div>`,
				},
			})

			const result = await aero.render('index', { title: 'Test Title' })
			expect(result).toBe('<div>Test Title</div>')
		})

		it('should expose bindable fallback helper to state SSR code', async () => {
			aero.registerPages({
				'pages/index.html': {
					default: (ctx: any) => `<div>${ctx.bindable('Fallback')}</div>`,
				},
			})

			const result = await aero.render('index')
			expect(result).toBe('<div>Fallback</div>')
		})

		/** normalizeRenderInput merges input into context; request/url are built from routePath when not provided. */
		it('should pass context with request, url, params, routePath', async () => {
			let capturedCtx: any
			aero.registerPages({
				'pages/index.html': {
					default: (ctx: any) => {
						capturedCtx = ctx
						return ''
					},
				},
			})

			await aero.render('index', { props: {}, params: { id: '1' } })

			expect(capturedCtx).toBeDefined()
			expect(capturedCtx.page).toBeDefined()
			expect(capturedCtx.page.request).toBeInstanceOf(Request)
			expect(capturedCtx.page.url).toBeInstanceOf(URL)
			expect(capturedCtx.page.params).toEqual({ id: '1' })
			expect(capturedCtx.page.routePath).toBe('/')
		})

		it('should expose canonical routePath regardless of trailing slash in request url', async () => {
			let capturedCtx: any
			aero.registerPages({
				'pages/demos/counter.html': {
					default: (ctx: any) => {
						capturedCtx = ctx
						return ''
					},
				},
			})

			await aero.render('demos/counter', {
				url: new URL('http://localhost/demos/counter/'),
				routePath: '/demos/counter/',
			})

			expect(capturedCtx.page.url.pathname).toBe('/demos/counter/')
			expect(capturedCtx.page.routePath).toBe('/demos/counter')
		})

		it('should pass routePath through renderComponent page context', async () => {
			let capturedCtx: any
			const child = async (ctx: any) => {
				capturedCtx = ctx
				return ''
			}

			await aero.renderComponent(child, {}, {}, {
				page: {
					url: new URL('http://localhost/demos/counter'),
					request: new Request('http://localhost/demos/counter'),
					params: {},
					routePath: '/demos/counter',
				},
			})

			expect(capturedCtx.page.routePath).toBe('/demos/counter')
		})

		it('should pass slots in context when provided in input', async () => {
			let capturedCtx: any
			aero.registerPages({
				'pages/index.html': {
					default: (ctx: any) => {
						capturedCtx = ctx
						return ''
					},
				},
			})

			await aero.render('index', {
				slots: { header: '<h1>Hi</h1>', footer: '<p>Bye</p>' },
			})

			expect(capturedCtx).toBeDefined()
			expect(capturedCtx.slots).toEqual({
				header: '<h1>Hi</h1>',
				footer: '<p>Bye</p>',
			})
		})

		it('should render error page with Aero.error and page input', async () => {
			let capturedCtx: any
			aero.registerPages({
				'pages/error.html': {
					default: (ctx: any) => {
						capturedCtx = ctx
						return `<div>${ctx.error.status}: ${ctx.error.message} — ${ctx.page.url.pathname}</div>`
					},
				},
			})

			const html = await aero.render('error', {
				error: { status: 404, message: 'Page not found' },
				params: { path: '/missing' },
				url: 'http://localhost/missing',
			})

			expect(capturedCtx).toBeDefined()
			expect(capturedCtx.error).toEqual({ status: 404, message: 'Page not found' })
			expect(html).toContain('404: Page not found')
		})

		it('should inject styles when error fallback reuses renderInput after unresolved route', async () => {
			aero.registerPages({
				'pages/error.html': {
					default: (ctx: any) => {
						ctx.styles?.add('<style>body { border: 1rem solid red; }</style>')
						return '<html lang="en"><head></head><body>404</body></html>'
					},
				},
			})

			const renderInput = { url: 'http://localhost/missing-page' }
			expect(await aero.render('missing-page', renderInput)).toBeNull()

			const html = await aero.render('error', {
				...renderInput,
				error: { status: 404, message: 'Page not found' },
			})
			expect(html).toContain('border: 1rem solid red')
		})

		it('should inject nested layout styles via renderComponent', async () => {
			const baseMod = {
				default: (ctx: any) => {
					ctx.styles?.add('<style>body { border: 1rem solid lime; }</style>')
					return '<html><head></head><body>layout</body></html>'
				},
			}
			aero.registerPages({
				'pages/nested-layout.html': {
					default: async (ctx: any) =>
						ctx.renderComponent(baseMod, {}, {}, {
							page: ctx.page,
							site: ctx.site,
							styles: ctx.styles,
							scripts: ctx.scripts,
							headScripts: ctx.headScripts,
						}),
				},
			})

			const html = await aero.render('nested-layout')
			expect(html).toContain('border: 1rem solid lime')
		})

		it('should inject layout and page styles on error fallback with shared renderInput', async () => {
			const baseMod = {
				default: (ctx: any) => {
					ctx.styles?.add('<style>body { border: 1rem solid lime; }</style>')
					return '<html lang="en"><head></head><body>404</body></html>'
				},
			}
			aero.registerPages({
				'pages/error.html': {
					default: async (ctx: any) => {
						ctx.styles?.add('<style>header { background: yellow; }</style>')
						return ctx.renderComponent(baseMod, {}, {}, {
							page: ctx.page,
							site: ctx.site,
							error: ctx.error,
							styles: ctx.styles,
							scripts: ctx.scripts,
							headScripts: ctx.headScripts,
						})
					},
				},
			})

			const renderInput = { url: 'http://localhost/missing-page' }
			expect(await aero.render('missing-page', renderInput)).toBeNull()

			const html = await aero.render('error', {
				...renderInput,
				error: { status: 404, message: 'Page not found' },
			})
			expect(html).toContain('border: 1rem solid lime')
			expect(html).toContain('background: yellow')
		})
	})

	/** Used by compiled templates; accepts function or module with default export. */
	describe('renderComponent', () => {
		it('should render component function', async () => {
			const fn = (ctx: any) => `<div>${ctx.props.name}</div>`
			const result = await aero.renderComponent(fn, { name: 'Test' })
			expect(result).toBe('<div>Test</div>')
		})

		it('should render component with default export', async () => {
			const mod = { default: (ctx: any) => `<span>${ctx.props.value}</span>` }
			const result = await aero.renderComponent(mod, { value: '123' })
			expect(result).toBe('<span>123</span>')
		})

		it('should provide renderComponent in context', async () => {
			let ctx: any
			const component = (c: any) => {
				ctx = c
				return ''
			}

			await aero.renderComponent(component, {})

			expect(ctx.renderComponent).toBeDefined()
			expect(typeof ctx.renderComponent).toBe('function')
		})
	})

	describe('mountStateBindingsForPath', () => {
		it('mounts route module state bindings and returns cleanup', () => {
			const target = {} as HTMLElement
			let mounted = false
			let cleaned = false
			aero.registerPages({
				'pages/index.html': {
					default: () => '<div></div>',
					mountStateBindings(root: HTMLElement, runtime: unknown) {
						mounted = true
						expect(root).toBe(target)
						expect(runtime as Aero).toBe(aero)
						return () => {
							cleaned = true
						}
					},
				},
			})

			const destroy = aero.mountStateBindingsForPath('/', target)
			expect(mounted).toBe(true)
			destroy()
			expect(cleaned).toBe(true)
		})

		it('returns no-op cleanup when route has no state mount export', () => {
			aero.registerPages({
				'pages/index.html': { default: () => '<div></div>' },
			})
			expect(() => aero.mountStateBindingsForPath('/', {} as HTMLElement)).not.toThrow()
		})
	})
})

// instance.ts and onUpdate are not unit-tested here: the module uses import.meta.glob('@components/...')
// which requires a Vite app context. They are covered by client entry (core/src/entry-dev.ts) and dev/build usage.
