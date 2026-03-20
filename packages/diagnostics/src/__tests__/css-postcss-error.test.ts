import { describe, expect, it } from 'vitest'
import { augmentFromCssSyntaxError, normalizePostcssDisplayPath } from '../css-postcss-error'
import { unknownToAeroDiagnostics } from '../from-unknown'

describe('css-postcss-error', () => {
	it('normalizePostcssDisplayPath strips query and notes style extract', () => {
		const { displayFile, styleExtractHint } = normalizePostcssDisplayPath(
			'/proj/pages/index.html?html-proxy&index=3.css'
		)
		expect(displayFile).toBe('/proj/pages/index.html')
		expect(styleExtractHint).toContain('#3')
	})

	it('augmentFromCssSyntaxError prefers reason and real file', () => {
		const err = new Error('ignored')
		err.name = 'CssSyntaxError'
		// 14 lines of `x`, line 15 is `  }` — PostCSS column is 1-based (points at `}`).
		const source = `${Array.from({ length: 14 }, () => 'x').join('\n')}\n  }`
		Object.assign(err, {
			reason: 'Unexpected }',
			file: '/kitchen-sink/index.html?html-proxy&index=3.css',
			line: 15,
			column: 3,
			source,
		})
		const a = augmentFromCssSyntaxError(err)
		expect(a).not.toBeNull()
		expect(a!.message).toBe('Unexpected }')
		expect(a!.file).toBe('/kitchen-sink/index.html')
		expect(a!.span).toEqual({ file: '/kitchen-sink/index.html', line: 15, column: 3 })
		expect(a!.frame).toContain('^')
		expect(a!.frame).toMatch(/> 15 \|/)
		expect(a!.hint).toContain('inline <style>')
	})

	it('unknownToAeroDiagnostics maps CssSyntaxError without postcss stack frame', () => {
		const err = new Error('ignored')
		err.name = 'CssSyntaxError'
		err.stack = `${err.name}: x\n    at Input.error (/somewhere/node_modules/postcss/lib/input.js:135:16)`
		Object.assign(err, {
			reason: 'Unexpected }',
			file: '/app/page.html?html-proxy&index=0.css',
			line: 2,
			column: 1,
		})
		const d = unknownToAeroDiagnostics(err, {
			file: '/app/frontend/pages/index.html',
		})
		expect(d[0]!.file).toBe('/app/frontend/pages/index.html')
		expect(d[0]!.span?.line).toBe(2)
		expect(d[0]!.message).toBe('Unexpected }')
		expect(d[0]!.file).not.toContain('postcss')
		expect(d[0]!.hint).not.toContain('while rendering')
	})
})
