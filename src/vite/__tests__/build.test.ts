import { describe, expect, it } from 'vitest'
import { __internal } from '@src/vite/build'
import type { Manifest } from 'vite'

describe('vite build helpers', () => {
	it('maps routes to root-style output files', () => {
		expect(__internal.toOutputFile('')).toBe('index.html')
		expect(__internal.toOutputFile('404')).toBe('404.html')
		expect(__internal.toOutputFile('about')).toBe('about/index.html')
		expect(__internal.toOutputFile('docs/name')).toBe('docs/name/index.html')
	})

	it('rewrites route URLs to relative output paths', () => {
		const routeSet = new Set(['', 'about', 'docs', 'docs/name'])
		const manifest: Manifest = {}

		expect(__internal.rewriteAbsoluteUrl('/about', 'docs', manifest, routeSet)).toBe(
			'../about/',
		)
		expect(__internal.rewriteAbsoluteUrl('/docs/name', 'docs', manifest, routeSet)).toBe(
			'./name/',
		)
		expect(__internal.rewriteAbsoluteUrl('/', 'about', manifest, routeSet)).toBe('../')
	})

	it('rewrites asset URLs from manifest entries', () => {
		const routeSet = new Set<string>()
		const manifest: Manifest = {
			'client/index.ts': {
				file: 'assets/client/index-123.js',
				src: 'client/index.ts',
				isEntry: true,
			},
			'client/assets/styles/global.css': {
				file: 'assets/global-123.css',
				src: 'client/assets/styles/global.css',
				isEntry: true,
			},
		}

		expect(
			__internal.rewriteAbsoluteUrl('/client/index.ts', 'about', manifest, routeSet),
		).toBe('../assets/client/index-123.js')
		expect(
			__internal.rewriteAbsoluteUrl(
				'/client/assets/styles/global.css',
				'docs/name',
				manifest,
				routeSet,
			),
		).toBe('../../assets/global-123.css')
	})

	it('keeps api routes absolute for preview/server mode', () => {
		const routeSet = new Set<string>()
		const manifest: Manifest = {}
		expect(__internal.rewriteAbsoluteUrl('/api/submit', '', manifest, routeSet)).toBe(
			'/api/submit',
		)
	})
})
