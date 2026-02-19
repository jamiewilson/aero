import { describe, it, expect, beforeEach } from 'vitest'
import { Aero } from '../index'

describe('Aero class', () => {
	let aero: Aero

	beforeEach(() => {
		aero = new Aero()
	})

	describe('global', () => {
		it('should set a global value', () => {
			aero.global('site', { title: 'Test' })
			// Accessing internal state for testing
			expect((aero as any).globals.site).toEqual({ title: 'Test' })
		})

		it('should overwrite existing global', () => {
			aero.global('foo', 'bar')
			aero.global('foo', 'baz')
			expect((aero as any).globals.foo).toBe('baz')
		})
	})

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

	describe('resolveDynamicPage', () => {
		beforeEach(() => {
			aero = new Aero()
			aero.registerPages({
				'pages/[slug].html': { default: () => 'dynamic' },
				'pages/blog/[id].html': { default: () => 'blog' },
			})
		})

		it('should resolve dynamic page with single param', () => {
			const result = (aero as any).resolveDynamicPage('hello')
			expect(result).not.toBeNull()
			expect(result.params.slug).toBe('hello')
		})

		it('should resolve dynamic page with nested param', () => {
			const result = (aero as any).resolveDynamicPage('blog/123')
			expect(result).not.toBeNull()
			expect(result.params.id).toBe('123')
		})

		it('should resolve dynamic page for any path (wildcard behavior)', () => {
			// [slug] matches any single segment - this is expected behavior
			const result = (aero as any).resolveDynamicPage('static-page')
			expect(result).not.toBeNull()
			expect(result.params.slug).toBe('static-page')
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

		it('should pass context with request, url, params', async () => {
			let capturedCtx: any
			aero.registerPages({
				'pages/index.html': { 
					default: (ctx: any) => { 
						capturedCtx = ctx
						return '' 
					} 
				},
			})

			await aero.render('index', { props: {}, params: { id: '1' } })
			
			expect(capturedCtx).toBeDefined()
			expect(capturedCtx.request).toBeInstanceOf(Request)
			expect(capturedCtx.url).toBeInstanceOf(URL)
			expect(capturedCtx.params).toEqual({ id: '1' })
		})
	})

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
