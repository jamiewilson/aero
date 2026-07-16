import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { tryRefineHtmlReferenceErrorSpan } from '../refine-html-reference-error-span'

describe('tryRefineHtmlReferenceErrorSpan', () => {
	it('maps ReferenceError to the sole braced identifier in .html', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-refine-'))
		const file = path.join(dir, 'p.html')
		const src = [
			'<base>',
			'  <template switch="{ stat }">',
			'    <p case="a">A</p>',
			'  </template>',
			'  <script>',
			'    const x = 1',
			'  </script>',
			'</base>',
			'',
		].join('\n')
		fs.writeFileSync(file, src, 'utf8')

		const err = new Error('stat is not defined')
		err.name = 'ReferenceError'

		const refined = tryRefineHtmlReferenceErrorSpan(err, { file, line: 35, column: 1 }, file)
		expect(refined).toBeDefined()
		expect(refined!.line).toBe(2)
		expect(refined!.file).toBe(file)
		const line2 = src.split('\n')[1]!
		expect(line2.indexOf('stat')).toBe(refined!.column)

		fs.rmSync(dir, { recursive: true, force: true })
	})

	it('returns undefined when two braced occurrences exist', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-refine-'))
		const file = path.join(dir, 'q.html')
		fs.writeFileSync(file, '<div>{ stat }</div>\n<div>{ stat }</div>\n', 'utf8')
		const err = new Error('stat is not defined')
		err.name = 'ReferenceError'
		expect(tryRefineHtmlReferenceErrorSpan(err, { file, line: 1, column: 0 }, file)).toBeUndefined()
		fs.rmSync(dir, { recursive: true, force: true })
	})

	it('maps ReferenceError to first createID in is:state when stack points at unrelated HTML', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-refine-'))
		const file = path.join(dir, 'keyed.html')
		const src = [
			'<script is:state>',
			'\t//import { createID } from "./utils"',
			'\tlet items = Array.from({ length: 5 }, () => ({ id: createID() }))',
			'\tconst add = () => setItems([...items, { id: createID() }])',
			'</script>',
			'<style>',
			'\t@utility keyed-list {',
			'\t\t@apply list-inside font-mono text-sm space-y-2;',
			'\t}',
			'</style>',
			'',
		].join('\n')
		fs.writeFileSync(file, src, 'utf8')

		const err = new Error('createID is not defined')
		err.name = 'ReferenceError'

		// Generated JS line 8 is CSS in the HTML source (map: null).
		const refined = tryRefineHtmlReferenceErrorSpan(err, { file, line: 8, column: 52 }, file)
		expect(refined).toBeDefined()
		// First occurrence is the commented-out import (most useful for this class of error).
		expect(refined!.line).toBe(2)
		expect(refined!.file).toBe(file)
		const line2 = src.split('\n')[1]!
		expect(line2.indexOf('createID')).toBe(refined!.column)

		fs.rmSync(dir, { recursive: true, force: true })
	})

	it('keeps span when the reported HTML line already contains the identifier', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-refine-'))
		const file = path.join(dir, 'ok.html')
		const src = '<script is:state>\nlet x = missing()\n</script>\n'
		fs.writeFileSync(file, src, 'utf8')
		const err = new Error('missing is not defined')
		err.name = 'ReferenceError'
		expect(tryRefineHtmlReferenceErrorSpan(err, { file, line: 2, column: 8 }, file)).toBeUndefined()
		fs.rmSync(dir, { recursive: true, force: true })
	})
})
