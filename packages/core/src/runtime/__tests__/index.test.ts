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
					default: (ctx: any) => `<div>${ctx.props.title}</div>` 
				},
			})

			const result = await aero.render('index', { title: 'Test Title' })
			expect(result).toBe('<div>Test Title</div>')
		})

		/** normalizeRenderInput merges input into context; request/url are built from routePath when not provided. */
		it('should pass context with request, url, params', async () => {
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
			expect(capturedCtx.request).toBeInstanceOf(Request)
			expect(capturedCtx.url).toBeInstanceOf(URL)
			expect(capturedCtx.params).toEqual({ id: '1' })
		})
	})

	// TODO: render() with slots in context; 404 fallback (render('404', input)); instance.ts / onUpdate not covered.

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
})
