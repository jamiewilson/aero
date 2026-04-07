import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { buildRouteManifest, writeRouteManifestGenerated } from '../route-manifest'
import {
	renderRouteHelpersTs,
	renderRouteTypesDts,
	writeRouteTypesGenerated,
} from '../route-typegen'

describe('route manifest generation', () => {
	it('builds route manifest from pages tree with params and parent relationships', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-routes-'))
		try {
			fs.mkdirSync(path.join(root, 'client', 'pages', 'docs'), { recursive: true })
			fs.mkdirSync(path.join(root, 'client', 'pages', 'blog', '[id]'), { recursive: true })
			fs.writeFileSync(path.join(root, 'client', 'pages', 'index.html'), '<html></html>')
			fs.writeFileSync(path.join(root, 'client', 'pages', '404.html'), '<html></html>')
			fs.writeFileSync(path.join(root, 'client', 'pages', 'docs', 'index.html'), '<html></html>')
			fs.writeFileSync(path.join(root, 'client', 'pages', 'docs', '[slug].html'), '<html></html>')
			fs.writeFileSync(
				path.join(root, 'client', 'pages', 'blog', '[id]', 'edit.html'),
				'<html></html>'
			)

			const manifest = buildRouteManifest(root, 'client')
			expect(manifest.version).toBe(1)
			expect(manifest.pagesDir).toBe('client/pages')
			expect(manifest.routes.length).toBe(5)

			const docsSlug = manifest.routes.find(r => r.pageName === 'docs/[slug]')
			expect(docsSlug).toBeDefined()
			expect(docsSlug?.path).toBe('/docs/:slug')
			expect(docsSlug?.params).toEqual(['slug'])

			const docsIndex = manifest.routes.find(r => r.pageName === 'docs/index')
			expect(docsSlug?.parentId).toBe(docsIndex?.id)

			const route404 = manifest.routes.find(r => r.pageName === '404')
			expect(route404?.isNotFound).toBe(true)
			expect(route404?.parentId).toBeNull()
		} finally {
			fs.rmSync(root, { recursive: true, force: true })
		}
	})

	it('uses collision-safe route ids for static vs dynamic segments', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-routes-id-'))
		try {
			fs.mkdirSync(path.join(root, 'client', 'pages', 'blog'), { recursive: true })
			fs.writeFileSync(path.join(root, 'client', 'pages', 'blog', 'id.html'), '<html></html>')
			fs.writeFileSync(path.join(root, 'client', 'pages', 'blog', '[id].html'), '<html></html>')

			const manifest = buildRouteManifest(root, 'client')
			const staticRoute = manifest.routes.find(r => r.pageName === 'blog/id')
			const dynamicRoute = manifest.routes.find(r => r.pageName === 'blog/[id]')
			expect(staticRoute).toBeDefined()
			expect(dynamicRoute).toBeDefined()
			expect(staticRoute?.id).not.toBe(dynamicRoute?.id)
		} finally {
			fs.rmSync(root, { recursive: true, force: true })
		}
	})

	it('writes manifest + generated route types/helpers', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-routes-write-'))
		try {
			fs.mkdirSync(path.join(root, 'client', 'pages'), { recursive: true })
			fs.writeFileSync(path.join(root, 'client', 'pages', 'index.html'), '<html></html>')
			const { manifestPath, manifest } = writeRouteManifestGenerated(root, 'client')
			expect(fs.existsSync(manifestPath)).toBe(true)

			const dts = renderRouteTypesDts(manifest)
			expect(dts).toContain('export type AeroRouteId')
			const helpers = renderRouteHelpersTs(manifest)
			expect(helpers).toContain('export function pathFor')

			writeRouteTypesGenerated(root, manifest)
			expect(fs.existsSync(path.join(root, '.aero', 'generated', 'route-types.d.ts'))).toBe(true)
			expect(fs.existsSync(path.join(root, '.aero', 'generated', 'route-helpers.ts'))).toBe(true)
		} finally {
			fs.rmSync(root, { recursive: true, force: true })
		}
	})
})
