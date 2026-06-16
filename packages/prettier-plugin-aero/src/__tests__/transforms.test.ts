import { describe, expect, it } from 'vitest'
import { parseMinimalHtmlFromText } from '@aero-js/html-parser'
import { applyAeroTransforms } from '../transforms.js'
import { defaultAeroOptions } from '../options.js'

async function formatAero(
	source: string,
	options: Partial<typeof defaultAeroOptions> = {}
): Promise<string> {
	const doc = parseMinimalHtmlFromText(source)
	return applyAeroTransforms(source, doc.roots, { ...defaultAeroOptions, ...options }, {
		semi: false,
	})
}

describe('applyAeroTransforms', () => {
	it('rewrites build directives between bare and data- prefix forms', async () => {
		const input = '<div data-props="{ title }" data-for="{ const x of xs }"></div>'
		const output = await formatAero(input, { aeroAttributePrefix: false })
		expect(output).toContain('props="{ title }"')
		expect(output).toContain('for="{ const x of xs }"')
		expect(output).not.toContain('data-props')
	})

	it('adds data- prefix when aeroAttributePrefix is true', async () => {
		const input = '<div props="{ title }" if="{ ok }"></div>'
		const output = await formatAero(input, { aeroAttributePrefix: true })
		expect(output).toContain('data-props="{ title }"')
		expect(output).toContain('data-if="{ ok }"')
	})

	it('rewrites switch branch directives with string case and boolean default', async () => {
		const input =
			'<div switch="{ auth.state }"><a case="{ AuthState.SignedIn }">Out</a><a case="SignedOut">In</a><span default>Def</span></div>'
		const prefixed = await formatAero(input, { aeroAttributePrefix: true })
		expect(prefixed).toContain('data-switch="{ auth.state }"')
		expect(prefixed).toContain('data-case="{ AuthState.SignedIn }"')
		expect(prefixed).toContain('data-case="SignedOut"')
		expect(prefixed).toContain('data-default')
		expect(prefixed).not.toMatch(/\scase=/)
		expect(prefixed).not.toMatch(/\sdefault>/)

		const bare = await formatAero(prefixed, { aeroAttributePrefix: false })
		expect(bare).toContain('switch="{ auth.state }"')
		expect(bare).toContain('case="{ AuthState.SignedIn }"')
		expect(bare).toContain('case="SignedOut"')
		expect(bare).toContain('<span default>')
		expect(bare).not.toContain('data-case')
		expect(bare).not.toContain('data-default')
	})

	it('rewrites bare props attribute with prefix toggle', async () => {
		const input = '<header-component props />'
		const prefixed = await formatAero(input, { aeroAttributePrefix: true })
		expect(prefixed).toBe('<header-component data-props />')

		const bare = await formatAero(prefixed, { aeroAttributePrefix: false })
		expect(bare).toBe('<header-component props />')
	})

	it('applies aeroBracketSpacing to directive values and text interpolation', async () => {
		const input = '<p if="{ok}">{title}</p>'
		const spaced = await formatAero(input, { aeroBracketSpacing: true })
		expect(spaced).toContain('if="{ ok }"')
		expect(spaced).toContain('{ title }')

		const compact = await formatAero(spaced, { aeroBracketSpacing: false })
		expect(compact).toContain('if="{ok}"')
		expect(compact).toContain('{title}')
	})

	it('prefers self-closing *-component tags when enabled', async () => {
		const input = '<nav-component></nav-component>'
		const output = await formatAero(input, { aeroSelfClosingComponents: true })
		expect(output).toBe('<nav-component />')
	})

	it('does not self-close *-component tags with children', async () => {
		const input = '<nav-component><a href="/">Home</a></nav-component>'
		const output = await formatAero(input, { aeroSelfClosingComponents: true })
		expect(output).toContain('<nav-component>')
		expect(output).toContain('</nav-component>')
		expect(output).not.toMatch(/<nav-component\s*\/>/)
	})

	it('does not self-close *-layout tags', async () => {
		const input = '<site-layout></site-layout>'
		const output = await formatAero(input, { aeroSelfClosingComponents: true })
		expect(output).toBe('<site-layout></site-layout>')
	})

	it('applies aeroBracketSpacing to component prop attributes', async () => {
		const input = '<blank-layout title="{title}"><h1>{title}</h1></blank-layout>'
		const output = await formatAero(input, { aeroBracketSpacing: true })
		expect(output).toContain('title="{ title }"')
		expect(output).toContain('<h1>{ title }</h1>')
	})

	it('applies aeroBracketSpacing to braces inside mixed attribute strings', async () => {
		const input = '<base-layout title="Docs: {site.meta.title}" />'
		const spaced = await formatAero(input, { aeroBracketSpacing: true })
		expect(spaced).toContain('title="Docs: { site.meta.title }"')

		const compact = await formatAero(spaced, { aeroBracketSpacing: false })
		expect(compact).toContain('title="Docs: {site.meta.title}"')
	})

	it('applies aeroBracketSpacing to each brace region in a mixed attribute', async () => {
		const input = '<my-comp-component title="{title}/{slug}" />'
		const output = await formatAero(input, { aeroBracketSpacing: true })
		expect(output).toContain('title="{ title }/{ slug }"')
	})

	it('does not treat attribute-mode literal braces as interpolations', async () => {
		const input = '<my-comp-component title="{{ slug }} + {slug}" />'
		const output = await formatAero(input, { aeroBracketSpacing: true })
		expect(output).toContain('title="{{ slug }} + { slug }"')
	})

	it('does not corrupt nested markup when compacting bracket spacing', async () => {
		const input = `<blank-layout title="{ title }">
	<main>
		<header>
			<h1>{ title }</h1>
			<p>Sorry, the page you are looking for does not exist.</p>
		</header>
	</main>
</blank-layout>`
		const output = await formatAero(input, { aeroBracketSpacing: false })
		expect(output).toContain('<h1>{title}</h1>')
		expect(output).toContain('<p>Sorry, the page you are looking for does not exist.</p>')
		expect(output).not.toContain('<h1>{title}\n\t\t\t<p')
	})

	it('does not corrupt import destructuring inside script is:build blocks', async () => {
		const input = `<script is:build lang="ts">
import { getCollection, render } from 'aero:content'
</script>`
		const output = await formatAero(input, { aeroBracketSpacing: true })
		expect(output).toContain('import { getCollection, render } from')
		expect(output).not.toContain(';(getCollection, render)')
	})

	it('expands self-closing *-component tags when option is false', async () => {
		const input = '<nav-component />'
		const output = await formatAero(input, { aeroSelfClosingComponents: false })
		expect(output).toBe('<nav-component></nav-component>')
	})
})
