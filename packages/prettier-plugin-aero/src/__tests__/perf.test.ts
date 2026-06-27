import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseMinimalHtmlFromText } from '@aero-js/html-parser'
import { applyAeroTransforms, getParseCountForTests, resetTransformMetricsForTests } from '../transforms.js'
import { defaultAeroOptions } from '../options.js'
import {
	clearPreprocessCacheForTests,
	prettierFormatOptionsFingerprint,
} from '../preprocess-cache.js'

const packageDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(packageDir, '../../../..')

function fixturePath(...segments: string[]): string {
	return path.join(repoRoot, ...segments)
}

function readFixture(...segments: string[]): string {
	return fs.readFileSync(fixturePath(...segments), 'utf-8')
}

async function transform(
	source: string,
	prettierOptions: Record<string, unknown> = {},
	resetCaches = false
): Promise<string> {
	if (resetCaches) {
		resetTransformMetricsForTests()
		clearPreprocessCacheForTests()
	}
	const doc = parseMinimalHtmlFromText(source)
	return applyAeroTransforms(
		source,
		doc.roots,
		defaultAeroOptions,
		{ semi: false, ...prettierOptions },
		'full'
	)
}

async function transformWithoutReset(source: string): Promise<string> {
	resetTransformMetricsForTests()
	clearPreprocessCacheForTests()
	const doc = parseMinimalHtmlFromText(source)
	return applyAeroTransforms(source, doc.roots, defaultAeroOptions, { semi: false }, 'full')
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
		const formatted = await transform(source)
		resetTransformMetricsForTests()
		const again = await transform(formatted)
		expect(again).toBe(formatted)
		expect(getParseCountForTests()).toBe(0)
	})

	it('keeps cache entries separate for expression bracket spacing options', async () => {
		const source = '<p>{items.map((item)=>({foo:"bar"}))}</p>'
		const spaced = await transform(source, { bracketSpacing: true, printWidth: 120 }, true)
		const compact = await transform(source, { bracketSpacing: false, printWidth: 120 })

		expect(spaced).toContain('{ foo: "bar" }')
		expect(compact).toContain('{foo: "bar"}')
	})

	it('keeps cache entries separate for expression print width options', async () => {
		const source =
			'<p>{items.map((item)=>({label:item.label,value:item.value,description:item.description}))}</p>'
		const wide = await transform(source, { printWidth: 120 }, true)
		const narrow = await transform(source, { printWidth: 20 })

		expect(wide).toContain(
			'items.map((item) => ({ label: item.label, value: item.value, description: item.description }))'
		)
		expect(narrow).toContain('\n')
		expect(narrow).not.toContain(
			'items.map((item) => ({ label: item.label, value: item.value, description: item.description }))'
		)
	})

	it('keeps cache entries separate for embedded script tab width options', async () => {
		const source = `<script is:build>
const  value={ready:true}
if (ready) {
console.log('ready')
}
</script>`
		const tabs = await transform(source, { useTabs: true, tabWidth: 2 }, true)
		const spaces = await transform(source, { useTabs: false, tabWidth: 4 })

		expect(tabs).toContain('\tconsole.log("ready")')
		expect(spaces).toContain('    console.log("ready")')
	})

	it('fingerprints singleAttributePerLine separately for preprocess cache entries', () => {
		const shared = { semi: false, tabWidth: 2 }
		expect(
			prettierFormatOptionsFingerprint({ ...shared, singleAttributePerLine: false })
		).not.toBe(prettierFormatOptionsFingerprint({ ...shared, singleAttributePerLine: true }))
	})

	it('does not reparse HTML per interpolation when handling many interpolations', async () => {
		const attrs = Array.from({ length: 100 }, (_, i) => `data-${i}="{value${i}}"`)
		const source = `<div ${attrs.join(' ')}></div>`
		await transformWithoutReset(source)
		expect(getParseCountForTests()).toBeLessThanOrEqual(2)
	})
})
