import { describe, expect, it } from 'vitest'
import { collectTemplateInterpolationSites } from '../template-interpolation-sites'
import { parseAeroTemplateDocument } from '@aero-js/html-parser'
import { prepareAeroTemplateSource, tokenizeCurlyInterpolation } from '@aero-js/interpolation'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(fileURLToPath(new URL('../../../..', import.meta.url)))

const SNIPPET_HTML = `<code>{ \`<header-component bind:count="{ \${count} }" />\` }</code>`
const CONDITIONAL_HTML = `<script is:state>let n = 0</script>
<p if="{ n > 0 }">Positive</p>
<p else-if="{ n < 0 }">Negative</p>`
const ALPINE_HTML = `<div x-bind:class="{ foo }">{ bar }</div>`
const FOR_HTML = `<a for="{ const x of xs }" href="{ path }"> { label } </a>`
const COMMENT_HTML = `<!-- <foo-component /> --><p>{ visible }</p>`

describe('template prep contract', () => {
	it('snippet markup: one interpolation site, no phantom component in HTML tree', () => {
		const sites = collectTemplateInterpolationSites(SNIPPET_HTML)
		expect(sites).toHaveLength(1)
		expect(sites[0]?.expression.trim()).toBe(
			'`<header-component bind:count="{ ${count} }" />`'
		)

		const doc = parseAeroTemplateDocument(SNIPPET_HTML)
		const tags = [...doc.roots].flatMap(root => {
			const names: string[] = []
			const walk = (node: { tag?: string; children?: typeof node[] }) => {
				if (node.tag) names.push(node.tag)
				for (const child of node.children ?? []) walk(child)
			}
			walk(root)
			return names
		})
		expect(tags).not.toContain('header-component')
		expect(tags).toContain('code')
	})

	it('comparison operators are not escaped', () => {
		const prep = prepareAeroTemplateSource(CONDITIONAL_HTML)
		expect(prep.htmlSafeText).toContain('n < 0')
		expect(prep.htmlSafeText).not.toContain('\uE000')
	})

	it('alpine attrs are not Aero interpolation sites', () => {
		const sites = collectTemplateInterpolationSites(ALPINE_HTML)
		expect(sites).toHaveLength(1)
		expect(sites[0]?.expression.trim()).toBe('bar')
	})

	it('for directive value is not a text interpolation site', () => {
		const sites = collectTemplateInterpolationSites(FOR_HTML)
		expect(sites.map(s => s.expression.trim())).toEqual(['path', 'label'])
	})

	it('ignore zones cover HTML comments', () => {
		const prep = prepareAeroTemplateSource(COMMENT_HTML)
		const commentOffset = COMMENT_HTML.indexOf('<!--')
		expect(prep.ignoreZones.some(z => commentOffset >= z.start && commentOffset < z.end)).toBe(
			true
		)
	})

	it('template literal expr preserves ${count} for tokenization', () => {
		const expr = '`<header-component bind:count="{ ${count} }" />`'
		const segments = tokenizeCurlyInterpolation(`{ ${expr} }`)
		const interpolation = segments.find(s => s.kind === 'interpolation')
		expect(interpolation?.expression).toContain('${count}')
	})
})

function collectTsFiles(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (entry === 'node_modules' || entry === 'dist') continue
		const full = path.join(dir, entry)
		const stat = statSync(full)
		if (stat.isDirectory()) {
			collectTsFiles(full, out)
		} else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
			out.push(full)
		}
	}
	return out
}

describe('parse gate enforcement', () => {
	it('forbids raw parseMinimalHtmlFromText / parseAeroHtmlDocument outside html-parser', () => {
		const packagesDir = path.join(repoRoot, 'packages')
		const violations: string[] = []

		for (const file of collectTsFiles(packagesDir)) {
			if (file.includes('/html-parser/src/')) continue
			const content = readFileSync(file, 'utf8')
			if (/\bparseMinimalHtmlFromText\s*\(/.test(content)) {
				violations.push(`${path.relative(repoRoot, file)}: parseMinimalHtmlFromText`)
			}
			if (/\bparseAeroHtmlDocument\s*\(/.test(content)) {
				violations.push(`${path.relative(repoRoot, file)}: parseAeroHtmlDocument`)
			}
		}

		expect(violations).toEqual([])
	})
})
