import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Source files that ship to the browser via entry-dev / entry-prod (and hot path).
 * Must not statically import `effect` — keep Effect Node/tooling-only.
 */
const BROWSER_SHIPPED_SOURCES = [
	'src/entry-dev.ts',
	'src/entry-prod.ts',
	'src/runtime/client.ts',
	'src/runtime/index.ts',
	'src/runtime/instance.ts',
	'src/types.ts',
]

const effectImport = /from\s+['"]effect(?:\/[^'"]*)?['"]/

describe('browser entry does not import effect', () => {
	const coreRoot = path.resolve(__dirname, '../../../../packages/core')

	for (const rel of BROWSER_SHIPPED_SOURCES) {
		it(`${rel} has no effect import`, () => {
			const abs = path.join(coreRoot, rel)
			const src = fs.readFileSync(abs, 'utf-8')
			expect(src, rel).not.toMatch(effectImport)
			expect(src, rel).not.toMatch(/require\(\s*['"]effect/)
		})
	}

	it('dist/entry-dev.mjs has no effect import when present', () => {
		const built = path.join(coreRoot, 'dist/entry-dev.mjs')
		if (!fs.existsSync(built)) return
		const out = fs.readFileSync(built, 'utf-8')
		expect(out).not.toMatch(effectImport)
	})
})
