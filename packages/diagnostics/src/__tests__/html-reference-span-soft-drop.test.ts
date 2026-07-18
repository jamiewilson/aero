/**
 * Soft-drop misleading HTML ReferenceError spans when the stack line lacks the identifier.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { unknownToAeroDiagnostics } from '../from-unknown'

describe('HTML ReferenceError span soft-drop', () => {
	const dirs: string[] = []

	afterEach(() => {
		for (const d of dirs) fs.rmSync(d, { recursive: true, force: true })
		dirs.length = 0
	})

	it('snaps to the first live props site when the stack line has no id', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-span-'))
		dirs.push(dir)
		const file = path.join(dir, 'base.html')
		fs.writeFileSync(
			file,
			`<html>
<body id="custom-target">
  <meta-component props />
</body>
</html>
`
		)
		const err = new Error('props is not defined')
		err.name = 'ReferenceError'
		err.stack = `ReferenceError: props is not defined
    at render (${file}:2:48)`
		const d = unknownToAeroDiagnostics(err)
		expect(d[0]!.span).toEqual({ file, line: 3, column: 18 })
		expect(d[0]!.message).toBe('props is not defined')
	})

	it('keeps span when the stack line contains the missing id', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-span-'))
		dirs.push(dir)
		const file = path.join(dir, 'base.html')
		const source = `<html><body><meta-component props /></body></html>\n`
		fs.writeFileSync(file, source)
		const propsCol = source.indexOf('props')
		// V8 1-based column at start of props
		const err = new Error('props is not defined')
		err.name = 'ReferenceError'
		err.stack = `ReferenceError: props is not defined
    at render (${file}:1:${propsCol + 1})`
		const d = unknownToAeroDiagnostics(err)
		expect(d[0]!.span).toEqual({ file, line: 1, column: propsCol })
	})

	it('snaps column onto the identifier when remapped column misses it', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-span-'))
		dirs.push(dir)
		const file = path.join(dir, 'keyed.html')
		const line =
			'\tlet items = Array.from({ length: 5 }, () => ({ id: createID() }))\n'
		fs.writeFileSync(file, `<script is:state>\n${line}</script>\n`)
		const idCol = line.indexOf('createID')
		const err = new Error('createID is not defined')
		err.name = 'ReferenceError'
		// Wrong remapped column (near `length`), 1-based → still misses createID after -1
		err.stack = `ReferenceError: createID is not defined
    at eval (${file}:2:33)`
		const d = unknownToAeroDiagnostics(err)
		expect(d[0]!.span).toEqual({ file, line: 2, column: idCol })
	})

	it('snaps to the first live createID, not a later duplicate call site', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-span-'))
		dirs.push(dir)
		const file = path.join(dir, 'keyed.html')
		fs.writeFileSync(
			file,
			`<script is:state>
	//import { createID } from './utils'
	let items = Array.from({ length: 1 }, () => ({ id: createID() }))
	const addRandom = () => ({ id: createID() })
</script>
`
		)
		const err = new Error('createID is not defined')
		err.name = 'ReferenceError'
		// Remapped to addRandom (line 4) — should snap to Array.from (line 3)
		err.stack = `ReferenceError: createID is not defined
    at eval (${file}:4:40)
    at Array.from (<anonymous>)`
		const d = unknownToAeroDiagnostics(err)
		expect(d[0]!.span?.line).toBe(3)
		expect(d[0]!.span?.column).toBe(
			'\tlet items = Array.from({ length: 1 }, () => ({ id: createID() }))'.indexOf('createID')
		)
	})

	it('snaps camelCase component bindings to the kebab component tag', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-span-'))
		dirs.push(dir)
		const file = path.join(dir, 'home.html')
		const source = `<script is:build>
	// import demoList from '@components/demo-list.html'
</script>
<article>
	<demo-list-component />
</article>
`
		fs.writeFileSync(file, source)
		const err = new Error('demoList is not defined')
		err.name = 'ReferenceError'
		err.stack = `ReferenceError: demoList is not defined
    at render (${file}:12:45)`
		const d = unknownToAeroDiagnostics(err)
		expect(d[0]!.span).toEqual({
			file,
			line: 5,
			column: source.split('\n')[4]!.indexOf('demo-list-component'),
		})
	})

	it('prefers <code-component> over native <code> for missing code import', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-span-'))
		dirs.push(dir)
		const file = path.join(dir, 'images.html')
		const source = `<script is:build>
	//import code from '@components/code.html'
</script>
<p>Import from <code>@images/</code>.</p>
<code-component code="{ x }" />
`
		fs.writeFileSync(file, source)
		const err = new Error('code is not defined')
		err.name = 'ReferenceError'
		err.stack = `ReferenceError: code is not defined
    at render (${file}:3:20)`
		const d = unknownToAeroDiagnostics(err)
		const tagLine = source.split('\n').findIndex(l => l.includes('code-component'))
		expect(d[0]!.span).toEqual({
			file,
			line: tagLine + 1,
			column: source.split('\n')[tagLine]!.indexOf('code-component'),
		})
	})
})
