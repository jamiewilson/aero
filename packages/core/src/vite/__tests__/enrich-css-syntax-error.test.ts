import fs from 'node:fs'
import os from 'node:os'
import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { enrichCssSyntaxError } from '../css-syntax-error-probe'
import { collectClientStyleCssFiles } from '../collect-client-style-css'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../')
const kitchenSink = path.join(repoRoot, 'examples/kitchen-sink')

describe('enrichCssSyntaxError', () => {
	it('collectClientStyleCssFiles finds kitchen-sink styles', () => {
		const files = collectClientStyleCssFiles(kitchenSink, 'client')
		expect(files.some(f => f.endsWith(`${path.sep}code.css`))).toBe(true)
	})

	it('recovers original file/line for location-less Tailwind CssSyntaxError', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-css-enrich-'))
		const styles = path.join(dir, 'assets/styles')
		fs.mkdirSync(styles, { recursive: true })
		const codeCss = path.join(styles, 'code.css')
		fs.writeFileSync(codeCss, 'a {\n  color: red;\n}\n}\n')

		const err = new Error('Missing opening {')
		err.name = 'CssSyntaxError'
		Object.assign(err, {
			plugin: '@tailwindcss/vite:generate:serve',
			id: '\0/demos/hypermedia?html-proxy&direct&index=0.css',
		})

		const enriched = await enrichCssSyntaxError(err, {
			root: kitchenSink,
			candidateFiles: [codeCss],
			resolveCss: async (id, base) => {
				const abs = path.isAbsolute(id) ? id : path.resolve(base, id)
				return abs
			},
		})

		expect(enriched).toBeInstanceOf(Error)
		const e = enriched as Error & { loc?: unknown; id?: string }
		expect(e.name).toBe('CssSyntaxError')
		expect(e.message).toContain('code.css')
		expect(e.message).toMatch(/:\d+:\d+:/)
		expect(e.id).toContain(`${path.sep}code.css`)
		expect(Array.isArray(e.loc)).toBe(true)
		expect((e.loc as [{ file: string }])[0]!.file).toBe(codeCss)
	})

	it('never prefers Vite dependency dumps over a real stylesheet location', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-css-enrich-'))
		const styles = path.join(dir, 'assets/styles')
		fs.mkdirSync(styles, { recursive: true })
		const baseCss = path.join(styles, 'base.css')
		const globalCss = path.join(styles, 'global.css')
		fs.writeFileSync(baseCss, 'a {\n  color: red;\n}\n}\n')
		fs.writeFileSync(globalCss, '@import "tailwindcss";\n@import "./base.css";\n')

		const viteDeps = path.join(dir, 'node_modules/.vite/deps/tailwindcss.js')
		fs.mkdirSync(path.dirname(viteDeps), { recursive: true })
		fs.writeFileSync(viteDeps, '//#endregion\n')

		const err = new Error(`[postcss] ${viteDeps}:1:1: Invalid declaration`)
		err.name = 'CssSyntaxError'
		Object.assign(err, {
			file: viteDeps,
			id: viteDeps,
			line: 1,
			column: 1,
			source: '//#endregion\n',
			plugin: '@tailwindcss/vite:generate:serve',
		})

		const enriched = await enrichCssSyntaxError(err, {
			root: kitchenSink,
			entryId: baseCss,
			entryCode: fs.readFileSync(baseCss, 'utf8'),
			candidateFiles: [globalCss, baseCss],
			resolveCss: async (id, base) => {
				if (id === 'tailwindcss') return viteDeps
				const abs = path.isAbsolute(id) ? id : path.resolve(base, id)
				return abs
			},
		})

		const e = enriched as Error & { file?: string; id?: string }
		expect(e.file).toBe(baseCss)
		expect(e.id).toBe(baseCss)
		expect(String(e.message)).not.toContain('.vite/deps')
	})
})
