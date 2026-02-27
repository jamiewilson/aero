/**
 * Unit tests for compiler helpers (helpers.ts): interpolation, attributes, props string building,
 * slot/conditional/loop emitters, and related utilities.
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
	emitRenderFunction,
	emitSlotVar,
	emitAppend,
	emitIf,
	emitElseIf,
	emitElse,
	emitEnd,
	emitForOf,
	emitSlotOutput,
	RENDER_COMPONENT_CONTEXT_PAIRS,
	getRenderComponentContextArg,
	getRenderContextDestructurePattern,
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
		expect(compileAttributeInterpolation('{name}')).toBe('${name}')
	})

	it('should escape backticks', () => {
		expect(compileAttributeInterpolation('`test`')).toBe('\\`test\\`')
	})

	it('should handle escaped braces {{ and }}', () => {
		expect(compileAttributeInterpolation('{{ literal }}')).toBe('{ literal }')
	})

	it('should handle mixed escaped and interpolation', () => {
		expect(compileAttributeInterpolation('{{ {expr} }}')).toBe('{ ${expr} }')
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

describe('renderComponent context (single source of truth)', () => {
	it('RENDER_COMPONENT_CONTEXT_PAIRS includes all pass-through keys', () => {
		expect(RENDER_COMPONENT_CONTEXT_PAIRS).toEqual([
			['request', 'request'],
			['url', 'url'],
			['params', 'params'],
			['site', '__aero_site'],
			['styles', 'styles'],
			['scripts', 'scripts'],
			['headScripts', 'injectedHeadScripts'],
		])
	})

	it('getRenderComponentContextArg returns object literal string for 4th arg', () => {
		const arg = getRenderComponentContextArg()
		expect(arg).toContain('request')
		expect(arg).toContain('url')
		expect(arg).toContain('params')
		expect(arg).toContain('site: __aero_site')
		expect(arg).toContain('styles')
		expect(arg).toContain('scripts')
		expect(arg).toContain('headScripts: injectedHeadScripts')
	})

	it('getRenderContextDestructurePattern includes slots, renderComponent, and context keys', () => {
		const pattern = getRenderContextDestructurePattern()
		expect(pattern).toContain('slots = {}')
		expect(pattern).toContain('renderComponent')
		expect(pattern).toContain('headScripts: injectedHeadScripts')
	})

	it('emitRenderFunction destructuring matches getRenderComponentContextArg keys', () => {
		const fn = emitRenderFunction('', '')
		expect(fn).toContain(getRenderContextDestructurePattern())
	})
})
