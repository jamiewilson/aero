import { describe, it, expect } from 'vitest'
import { aeroContent } from '../vite'

describe('aeroContent', () => {
	it('should return a plugin with the correct name', () => {
		const plugin = aeroContent()
		expect(plugin.name).toBe('vite-plugin-aero-content')
	})

	it('should accept custom config path option', () => {
		const plugin = aeroContent({ config: 'custom.content.ts' })
		expect(plugin.name).toBe('vite-plugin-aero-content')
	})

	describe('resolveId', () => {
		it('should resolve aero:content to the virtual module ID', () => {
			const plugin = aeroContent()
			const resolveId = plugin.resolveId as Function
			expect(resolveId('aero:content')).toBe('\0aero:content')
		})

		it('should resolve aero:content/collection to the same virtual module', () => {
			const plugin = aeroContent()
			const resolveId = plugin.resolveId as Function
			expect(resolveId('aero:content/docs')).toBe('\0aero:content')
			expect(resolveId('aero:content/posts')).toBe('\0aero:content')
		})

		it('should return null for unrelated module IDs', () => {
			const plugin = aeroContent()
			const resolveId = plugin.resolveId as Function
			expect(resolveId('some-other-module')).toBeNull()
			expect(resolveId('aero:other')).toBeNull()
		})
	})

	describe('load', () => {
		it('should return a comment stub when no config is loaded', async () => {
			const plugin = aeroContent()
			const load = plugin.load as Function
			const result = await load('\0aero:content')
			expect(result).toContain('no collections configured')
		})

		it('should return null for unrelated module IDs', async () => {
			const plugin = aeroContent()
			const load = plugin.load as Function
			const result = await load('some-other-module')
			expect(result).toBeNull()
		})
	})
})
