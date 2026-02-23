/**
 * Unit tests for compiler helpers (helpers.ts): interpolation, attributes, props string building,
 * slot/conditional/loop emitters, extractGetStaticPaths, extractObjectKeys, and related utilities.
 */

import { describe, it, expect } from 'vitest'
import {
	compileInterpolation,
	compileAttributeInterpolation,
	isAttr,
	stripBraces,
	kebabToCamelCase,
	buildPropsString,
	escapeBackticks,
	emitSlotsObjectVars,
	extractGetStaticPaths,
	extractObjectKeys,
	emitRenderFunction,
	emitSlotVar,
	emitAppend,
	emitIf,
	emitElseIf,
	emitElse,
	emitEnd,
	emitForOf,
	emitSlotOutput,
} from '../helpers'

describe('compileInterpolation', () => {
	it('should return empty string for empty input', () => {
		expect(compileInterpolation('')).toBe('')
	})

	it('should convert {expr} to ${expr}', () => {
		expect(compileInterpolation('hello {name}')).toBe('hello ${name}')
	})

	it('should escape backticks', () => {
		expect(compileInterpolation('hello `world`')).toBe('hello \\`world\\`')
	})

	it('should handle multiple interpolations', () => {
		expect(compileInterpolation('{a} and {b}')).toBe('${a} and ${b}')
	})
})

describe('compileAttributeInterpolation', () => {
	it('should return empty string for empty input', () => {
		expect(compileAttributeInterpolation('')).toBe('')
	})

	it('should convert {expr} to ${expr}', () => {
		expect(compileAttributeInterpolation('value="{name}"')).toBe('value="${name}"')
	})

	it('should escape backticks', () => {
		expect(compileAttributeInterpolation('value="`test`"')).toBe('value="\\`test\\`"')
	})

	it('should handle escaped braces {{ and }}', () => {
		expect(compileAttributeInterpolation('value="{{ literal }}"')).toBe('value="{ literal }"')
	})

	it('should handle mixed escaped and interpolation', () => {
		expect(compileAttributeInterpolation('value="{{ {expr} }}"')).toBe('value="{ ${expr} }"')
	})
})

describe('isAttr', () => {
	it('should match exact attribute name', () => {
		expect(isAttr('if', 'if', 'data-')).toBe(true)
		expect(isAttr('is:build', 'is:build', '')).toBe(true)
	})

	it('should match prefixed attribute name', () => {
		expect(isAttr('data-if', 'if', 'data-')).toBe(true)
		expect(isAttr('data-each', 'each', 'data-')).toBe(true)
	})

	it('should not match unrelated attributes', () => {
		expect(isAttr('class', 'if', 'data-')).toBe(false)
		expect(isAttr('href', 'if', 'data-')).toBe(false)
	})
})

describe('stripBraces', () => {
	it('should strip surrounding braces', () => {
		expect(stripBraces('{expr}')).toBe('expr')
	})

	it('should handle whitespace', () => {
		expect(stripBraces('{ expr }')).toBe('expr')
	})

	it('should not modify string without braces', () => {
		expect(stripBraces('expr')).toBe('expr')
	})
})

describe('kebabToCamelCase', () => {
	it('should convert kebab to camelCase', () => {
		expect(kebabToCamelCase('my-component')).toBe('myComponent')
	})

	it('should handle multiple hyphens', () => {
		expect(kebabToCamelCase('my-long-component-name')).toBe('myLongComponentName')
	})

	it('should handle single word', () => {
		expect(kebabToCamelCase('component')).toBe('component')
	})
})

describe('buildPropsString', () => {
	it('should build props with entries only', () => {
		expect(buildPropsString(['title="Hello"'], null)).toBe('{ title="Hello" }')
	})

	it('should build props with spread only', () => {
		expect(buildPropsString([], 'props')).toBe('{ props }')
	})

	it('should build props with spread and entries', () => {
		expect(buildPropsString(['title="Hello"'], 'props')).toBe('{ props, title="Hello" }')
	})

	it('should handle multiple entries', () => {
		expect(buildPropsString(['a="1"', 'b="2"'], null)).toBe('{ a="1", b="2" }')
	})
})

describe('escapeBackticks', () => {
	it('should escape backticks', () => {
		expect(escapeBackticks('hello `world`')).toBe('hello \\`world\\`')
	})

	it('should handle no backticks', () => {
		expect(escapeBackticks('hello world')).toBe('hello world')
	})
})

describe('emitSlotsObjectVars', () => {
	it('should emit slots object', () => {
		expect(emitSlotsObjectVars({ default: '__slot_default' })).toBe(
			'{ "default": __slot_default }',
		)
	})

	it('should handle multiple slots', () => {
		expect(emitSlotsObjectVars({ default: '__s1', header: '__s2' })).toBe(
			'{ "default": __s1, "header": __s2 }',
		)
	})

	it('should handle empty object', () => {
		expect(emitSlotsObjectVars({})).toBe('{  }')
	})
})

/** extractGetStaticPaths: splits build script into named export fn and remaining script for codegen. */
describe('extractGetStaticPaths', () => {
	it('should extract getStaticPaths function', () => {
		const script = `
export async function getStaticPaths() {
	return []
}
const foo = 'bar'
`
		const result = extractGetStaticPaths(script)
		expect(result.fnText).toContain('getStaticPaths')
		expect(result.remaining).toContain("const foo = 'bar'")
	})

	it('should return null when no getStaticPaths', () => {
		const script = `const foo = 'bar'`
		const result = extractGetStaticPaths(script)
		expect(result.fnText).toBeNull()
		expect(result.remaining).toBe(script)
	})
})

describe('emitRenderFunction', () => {
	it('should emit render function without getStaticPaths', () => {
		const result = emitRenderFunction('const name = "test"', '__out += name')
		expect(result).toContain('export default async function(Aero)')
		expect(result).toContain('const name = "test"')
	})

	it('should include getStaticPaths when provided', () => {
		const getStaticPathsFn = 'export async function getStaticPaths() { return [] }'
		const result = emitRenderFunction('', '', { getStaticPathsFn })
		expect(result).toContain('export async function getStaticPaths() { return [] }')
		expect(result).toContain('export default async function(Aero)')
	})

	it('should include styleCode and rootScriptsLines when provided', () => {
		const result = emitRenderFunction('', '__out += "x";', {
			styleCode: 'styles?.add("<style>");',
			rootScriptsLines: ['scripts?.add("<script src=a>");'],
		})
		expect(result).toContain('styles?.add("<style>");')
		expect(result).toContain('scripts?.add("<script src=a>");')
		expect(result).toContain('injectedHeadScripts')
	})
})

describe('emitSlotVar', () => {
	it('should emit slot variable declaration', () => {
		expect(emitSlotVar('header')).toBe("let header = '';\n")
	})
})

describe('emitAppend', () => {
	it('should emit append statement', () => {
		expect(emitAppend('hello')).toBe('__out += `hello`;\n')
	})

	it('should use custom output variable', () => {
		expect(emitAppend('hello', '__html')).toBe('__html += `hello`;\n')
	})
})

describe('emitIf', () => {
	it('should emit if statement', () => {
		expect(emitIf('condition')).toBe('if (condition) {\n')
	})
})

describe('emitElseIf', () => {
	it('should emit else if statement', () => {
		expect(emitElseIf('condition')).toBe('} else if (condition) {\n')
	})
})

describe('emitElse', () => {
	it('should emit else statement', () => {
		expect(emitElse()).toBe('} else {\n')
	})
})

describe('emitEnd', () => {
	it('should emit closing brace', () => {
		expect(emitEnd()).toBe('}\n')
	})
})

describe('emitForOf', () => {
	it('should emit for-of statement', () => {
		expect(emitForOf('item', 'items')).toBe('for (const item of items) {\n')
	})
})

describe('emitSlotOutput', () => {
	it('should emit slot output', () => {
		expect(emitSlotOutput('default', 'content')).toBe(
			"__out += slots['default'] ?? `content`;\n",
		)
	})

	it('should use custom output variable', () => {
		expect(emitSlotOutput('header', 'h', '__html')).toBe("__html += slots['header'] ?? `h`;\n")
	})
})

/** extractObjectKeys: parses object literal/shorthand to keys; used for pass:data preamble in client scripts. */
describe('extractObjectKeys', () => {
	it('should extract simple keys', () => {
		expect(extractObjectKeys('{ a: 1, b: 2 }')).toEqual(['a', 'b'])
	})

	it('should extract shorthand keys', () => {
		expect(extractObjectKeys('{ config, theme }')).toEqual(['config', 'theme'])
	})

	it('should handle mixed shorthand and full properties', () => {
		expect(extractObjectKeys('{ debug, title: header.title }')).toEqual(['debug', 'title'])
	})

	it('should ignore spread syntax', () => {
		expect(extractObjectKeys('{ ...spread, a: 1 }')).toEqual(['a'])
	})

	it('should handle nested objects and arrays', () => {
		expect(extractObjectKeys('{ nested: { a: 1, b: 2 }, arr: [1, 2, 3] }')).toEqual([
			'nested',
			'arr',
		])
	})

	it('should handle expressions with parentheses', () => {
		expect(extractObjectKeys('{ computed: (1 + 2) }')).toEqual(['computed'])
	})

	it('should handle no outer braces', () => {
		expect(extractObjectKeys('a: 1, b: 2')).toEqual(['a', 'b'])
	})

	it('should handle empty input', () => {
		expect(extractObjectKeys('{}')).toEqual([])
		expect(extractObjectKeys('  ')).toEqual([])
	})
})
