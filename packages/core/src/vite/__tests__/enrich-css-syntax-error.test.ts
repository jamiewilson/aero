import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	collectClientStyleCssFiles,
	enrichCssSyntaxError,
} from '../enrich-css-syntax-error'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../')
const kitchenSink = path.join(repoRoot, 'examples/kitchen-sink')

describe('enrichCssSyntaxError', () => {
	it('collectClientStyleCssFiles finds kitchen-sink styles', () => {
		const files = collectClientStyleCssFiles(kitchenSink, 'client')
		expect(files.some(f => f.endsWith(`${path.sep}code.css`))).toBe(true)
	})

	it('recovers original file/line for location-less Tailwind CssSyntaxError', async () => {
		const err = new Error('Missing opening {')
		err.name = 'CssSyntaxError'
		Object.assign(err, {
			plugin: '@tailwindcss/vite:generate:serve',
			id: '\0/demos/hypermedia?html-proxy&direct&index=0.css',
		})

		const styles = path.join(kitchenSink, 'client/assets/styles')
		const enriched = await enrichCssSyntaxError(err, {
			root: kitchenSink,
			candidateFiles: collectClientStyleCssFiles(kitchenSink, 'client'),
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
		expect((e.loc as [{ file: string }])[0]!.file).toBe(path.join(styles, 'code.css'))
	})
})
