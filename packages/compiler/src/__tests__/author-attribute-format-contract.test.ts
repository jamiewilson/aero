import { describe, expect, it } from 'vitest'
import {
	BUILD_DIRECTIVES,
} from '../build-directive-attributes'
import {
	PREFIXABLE_SCRIPT_IS_KINDS,
	PREFIXABLE_SIMPLE_RUNTIME_DIRECTIVES,
	formatAuthorAttributeName,
	listPrefixableAuthorAttributeDescriptors,
	resolveAuthorAttributeForFormatting,
} from '../author-attribute-format'
import { AUTHOR_ATTRIBUTE_PREFIX_SCENARIOS } from '../../../diagnostics/src/__tests__/fixtures/parity/author-attribute-prefix-scenarios'
import { parse } from '../parser'
import { compile } from '../codegen'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	importer: '/',
}

describe('author-attribute-format anti-drift contract', () => {
	it('lists every build directive, simple runtime, and script-is kind', () => {
		const ids = new Set(listPrefixableAuthorAttributeDescriptors().map(d => d.id))
		for (const name of BUILD_DIRECTIVES) {
			expect(ids.has(name), `missing build ${name}`).toBe(true)
		}
		for (const name of PREFIXABLE_SIMPLE_RUNTIME_DIRECTIVES) {
			expect(ids.has(name), `missing runtime ${name}`).toBe(true)
		}
		for (const kind of PREFIXABLE_SCRIPT_IS_KINDS) {
			expect(ids.has(`is:${kind}`), `missing script is:${kind}`).toBe(true)
		}
		expect(ids.has('key')).toBe(true)
		expect(ids.has('on:click')).toBe(true)
		expect(ids.has('class:is-active')).toBe(true)
		expect(ids.has('bind:count')).toBe(true)
	})

	it('round-trips every listed descriptor across prefix modes', () => {
		for (const desc of listPrefixableAuthorAttributeDescriptors()) {
			const canonical = resolveAuthorAttributeForFormatting(desc.exampleNone)
			expect(canonical, desc.id).not.toBeNull()
			for (const mode of ['none', 'aero', 'strict'] as const) {
				const formatted = formatAuthorAttributeName(canonical!, mode)
				expect(resolveAuthorAttributeForFormatting(formatted), `${desc.id} ${mode}`).toEqual(
					canonical
				)
			}
		}
	})

	it('compiles shared prefix scenarios that declare compileWithPrefix', () => {
		for (const scenario of AUTHOR_ATTRIBUTE_PREFIX_SCENARIOS) {
			if (!scenario.compileWithPrefix) continue
			const code = compile(parse(scenario.compileWithPrefix.html), mockOptions)
			expect(code.length, scenario.id).toBeGreaterThan(0)
		}
	})
})
