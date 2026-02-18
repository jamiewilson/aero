import { describe, it, expect, vi } from 'vitest'
import { Aero } from '../index'

describe('Aero Runtime - Unified Data Fetching', () => {
	it('should execute getStaticPaths and inject props when props are missing', async () => {
		const aero = new Aero()

		// Mock getStaticPaths
		const getStaticPaths = vi
			.fn()
			.mockResolvedValue([{ params: { slug: 'valid-slug' }, props: { title: 'Valid Page' } }])

		// Simulate a real module namespace object
		const pageModule = {
			getStaticPaths,
			default: vi.fn().mockImplementation(async context => {
				return `<h1>${context.props.title}</h1>`
			}),
			[Symbol.toStringTag]: 'Module',
		}

		aero.registerPages({
			'docs/[slug].html': pageModule,
		})

		// Render with valid slug but NO props
		const html = await aero.render('docs/[slug]', {
			params: { slug: 'valid-slug' },
		})

		expect(getStaticPaths).toHaveBeenCalled()
		expect(html).toBe('<h1>Valid Page</h1>')
	})

	it('should return null (404) if params do not match any path', async () => {
		const aero = new Aero()

		const getStaticPaths = vi
			.fn()
			.mockResolvedValue([{ params: { slug: 'valid-slug' }, props: { title: 'Valid Page' } }])

		const pageModule = {
			getStaticPaths,
			default: vi.fn().mockImplementation(async context => {
				return `<h1>${context.props.title}</h1>`
			}),
		}

		aero.registerPages({
			'docs/[slug].html': pageModule,
		})

		// Render with INVALID slug
		const html = await aero.render('docs/[slug]', {
			params: { slug: 'invalid-slug' },
		})

		expect(getStaticPaths).toHaveBeenCalled()
		expect(html).toBeNull()
	})

	it('should use provided props if available (skipping getStaticPaths validation in Build mode)', async () => {
		const aero = new Aero()

		const getStaticPaths = vi.fn() // Should NOT be called

		const pageModule = {
			getStaticPaths,
			default: vi.fn().mockImplementation(async context => {
				return `<h1>${context.props.title}</h1>`
			}),
		}

		aero.registerPages({
			'docs/[slug].html': pageModule,
		})

		// Render with props already provided
		const html = await aero.render('docs/[slug]', {
			params: { slug: 'any-slug' },
			props: { title: 'Provided Props' },
		})

		expect(getStaticPaths).not.toHaveBeenCalled()
		expect(html).toBe('<h1>Provided Props</h1>')
	})
})
