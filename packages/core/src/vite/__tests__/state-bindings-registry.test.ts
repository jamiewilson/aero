import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { discoverReactivePagePaths } from '../runtime-template-discovery'
import { getStateBindingsRegistryModuleSource } from '../state-bindings-registry'

describe('state bindings registry', () => {
	it('discovers pages with is:state only', () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-reactive-pages-'))
		try {
			const counterPath = path.join(tmp, 'client', 'pages', 'demos', 'counter.html')
			const aboutPath = path.join(tmp, 'client', 'pages', 'about.html')
			fs.mkdirSync(path.dirname(counterPath), { recursive: true })
			fs.writeFileSync(
				counterPath,
				`<script is:state>let count = 0</script><p>{ count }</p>`,
				'utf-8'
			)
			fs.writeFileSync(aboutPath, '<p>About</p>', 'utf-8')

			expect(discoverReactivePagePaths(tmp, 'client')).toEqual([counterPath])
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true })
		}
	})

	it('discovers pages that use reactive child components', () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-reactive-nested-'))
		try {
			const componentPath = path.join(tmp, 'client', 'components', 'tabs.html')
			const pagePath = path.join(tmp, 'client', 'pages', 'index.html')
			fs.mkdirSync(path.dirname(componentPath), { recursive: true })
			fs.mkdirSync(path.dirname(pagePath), { recursive: true })
			fs.writeFileSync(
				componentPath,
				`<script is:state>let tab = 'a'</script><button on:click="{ tab = 'b' }">{ tab }</button>`,
				'utf-8'
			)
			fs.writeFileSync(pagePath, '<tabs-component />', 'utf-8')

			expect(discoverReactivePagePaths(tmp, 'client')).toEqual([pagePath])
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true })
		}
	})

	it('generates lazy import loaders keyed by page name', () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-registry-src-'))
		try {
			const pagePath = path.join(tmp, 'client', 'pages', 'demos', 'counter.html')
			fs.mkdirSync(path.dirname(pagePath), { recursive: true })
			fs.writeFileSync(pagePath, '<script is:state>let count = 0</script>', 'utf-8')

			const source = getStateBindingsRegistryModuleSource(tmp, [pagePath])
			expect(source).toContain('"demos/counter": () => import("/client/pages/demos/counter.html")')
			expect(source).toContain('function __aeroResolvePageName(url)')
			expect(source).toContain('export async function resolveStateBindingsModule(pathname)')
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true })
		}
	})

	it('returns a no-op resolver when no reactive pages exist', () => {
		const source = getStateBindingsRegistryModuleSource('/tmp', [])
		expect(source).toContain('return null')
	})
})
