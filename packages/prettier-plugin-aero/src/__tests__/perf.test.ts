import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import prettier from 'prettier'
import { parseMinimalHtmlFromText } from '@aero-js/html-parser'
import plugin from '../index.js'
import { applyAeroTransforms, getParseCountForTests, resetTransformMetricsForTests } from '../transforms.js'
import { defaultAeroOptions } from '../options.js'
import { clearPreprocessCacheForTests } from '../preprocess-cache.js'

const baseOptions = {
	parser: 'aero' as const,
	plugins: [plugin],
	useTabs: true,
	tabWidth: 2,
	semi: false,
	aeroBracketSpacing: true,
	aeroSelfClosingComponents: true,
}

const packageDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(packageDir, '../../../..')

function fixturePath(...segments: string[]): string {
	return path.join(repoRoot, ...segments)
}

function readFixture(...segments: string[]): string {
	return fs.readFileSync(fixturePath(...segments), 'utf-8')
}

async function timePreprocess(source: string): Promise<number> {
	resetTransformMetricsForTests()
	clearPreprocessCacheForTests()
	const doc = parseMinimalHtmlFromText(source)
	const start = performance.now()
	await applyAeroTransforms(source, doc.roots, defaultAeroOptions, { semi: false }, 'full')
	return performance.now() - start
}

async function timeFullFormat(source: string): Promise<number> {
	clearPreprocessCacheForTests()
	const start = performance.now()
	await prettier.format(source, baseOptions)
	return performance.now() - start
}

describe('prettier-plugin-aero performance', () => {
	it('uses at most two HTML re-parses on a representative template', async () => {
		const source = readFixture('examples/kitchen-sink/client/pages/demos/form-model.html')
		resetTransformMetricsForTests()
		const doc = parseMinimalHtmlFromText(source)
		await applyAeroTransforms(source, doc.roots, defaultAeroOptions, { semi: false }, 'full')
		expect(getParseCountForTests()).toBeLessThanOrEqual(2)
	})

	it('no-ops preprocess on an already formatted template', async () => {
		const source = readFixture('examples/kitchen-sink/client/pages/demos/form-model.html')
		const doc = parseMinimalHtmlFromText(source)
		const formatted = await applyAeroTransforms(
			source,
			doc.roots,
			defaultAeroOptions,
			{ semi: false },
			'full'
		)
		resetTransformMetricsForTests()
		const formattedDoc = parseMinimalHtmlFromText(formatted)
		const again = await applyAeroTransforms(
			formatted,
			formattedDoc.roots,
			defaultAeroOptions,
			{ semi: false },
			'full'
		)
		expect(again).toBe(formatted)
		expect(getParseCountForTests()).toBe(0)
	})

	it('formats form-model preprocess within budget', async () => {
		const source = readFixture('examples/kitchen-sink/client/pages/demos/form-model.html')
		const elapsed = await timePreprocess(source)
		expect(elapsed).toBeLessThan(200)
	})

	it('formats form-model end-to-end within budget', async () => {
		const source = readFixture('examples/kitchen-sink/client/pages/demos/form-model.html')
		const elapsed = await timeFullFormat(source)
		expect(elapsed).toBeLessThan(800)
	})

	it('formats docs index end-to-end within budget', async () => {
		const source = readFixture('examples/kitchen-sink/client/pages/docs/index.html')
		const elapsed = await timeFullFormat(source)
		expect(elapsed).toBeLessThan(800)
	})

	it('handles many interpolations within budget', async () => {
		const attrs = Array.from({ length: 100 }, (_, i) => `data-${i}="{value${i}}"`)
		const source = `<div ${attrs.join(' ')}></div>`
		const elapsed = await timePreprocess(source)
		expect(elapsed).toBeLessThan(500)
	})
})
