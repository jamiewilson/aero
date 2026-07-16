import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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

	it('augmentFromCssSyntaxError remaps compiled entry CSS to imported sibling stylesheet', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-css-remap-'))
		const styles = path.join(dir, 'styles')
		fs.mkdirSync(styles, { recursive: true })
		const globalCss = path.join(styles, 'global.css')
		const baseCss = path.join(styles, 'base.css')
		fs.writeFileSync(globalCss, `@import "tailwindcss";\n@import "base.css";\n`)
		fs.writeFileSync(
			baseCss,
			`@layer base {\n  html, body {\n    font-size: var(--font-size)\n    line-height: 1.5;\n  }\n}\n`
		)
		const compiledLine = '    font-size: var(--font-size)\tline-height: var(--line-height);'
		const err = new Error(`${globalCss}:952:19: Missed semicolon`)
		err.name = 'CssSyntaxError'
		Object.assign(err, {
			file: globalCss,
			line: 952,
			column: 19,
			source: `${Array.from({ length: 951 }, (_, i) => `x${i}`).join('\n')}\n${compiledLine}\n`,
		})
		const a = augmentFromCssSyntaxError(err)
		expect(a).not.toBeNull()
		expect(a!.file).toBe(baseCss)
		expect(a!.span?.file).toBe(baseCss)
		expect(a!.span?.line).toBe(3)
		expect(a!.frame).toContain('font-size: var(--font-size)')
		expect(a!.frame).toMatch(/> 3 \|/)
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

	it('augmentFromCssSyntaxError maps Tailwind loc [source, offset, offset]', () => {
		const code = 'a {\n  color: red;\n}\n}'
		const offset = code.length - 1
		const err = new Error(`/abs/styles/code.css:4:1: Missing opening {`)
		err.name = 'CssSyntaxError'
		Object.assign(err, {
			loc: [{ file: '/abs/styles/code.css', code }, offset, offset],
		})
		const a = augmentFromCssSyntaxError(err)
		expect(a).not.toBeNull()
		expect(a!.message).toBe('Missing opening {')
		expect(a!.file).toBe('/abs/styles/code.css')
		expect(a!.span).toEqual({ file: '/abs/styles/code.css', line: 4, column: 1 })
		expect(a!.frame).toMatch(/> 4 \|/)
	})

	it('augmentFromCssSyntaxError parses file:line:col from Tailwind message when loc is missing', () => {
		const err = new Error(`/proj/client/assets/styles/code.css:192:1: Missing opening {`)
		err.name = 'CssSyntaxError'
		const a = augmentFromCssSyntaxError(err)
		expect(a).not.toBeNull()
		expect(a!.message).toBe('Missing opening {')
		expect(a!.file).toBe('/proj/client/assets/styles/code.css')
		expect(a!.span).toEqual({
			file: '/proj/client/assets/styles/code.css',
			line: 192,
			column: 1,
		})
	})

	it('unknownToAeroDiagnostics prefers Tailwind CSS file over html-proxy Vite id', () => {
		const code = '}\n'
		const err = new Error(`/abs/code.css:1:1: Missing opening {`)
		err.name = 'CssSyntaxError'
		Object.assign(err, {
			plugin: '@tailwindcss/vite:generate:serve',
			id: '\0/demos/hypermedia?html-proxy&direct&index=0.css',
			loc: [{ file: '/abs/code.css', code }, 0, 0],
		})
		const d = unknownToAeroDiagnostics(err, {
			file: '/app/client/pages/demos/hypermedia.html',
		})
		expect(d[0]!.file).toBe('/abs/code.css')
		expect(d[0]!.span).toEqual({ file: '/abs/code.css', line: 1, column: 1 })
		expect(d[0]!.message).toBe('Missing opening {')
		expect(d[0]!.hint).toBeUndefined()
	})
})
