import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const distIndex = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../dist/index.mjs')

describe('client bundle imports', () => {
	it('does not pull the compiler barrel (oxc-parser) into the browser graph', () => {
		const source = fs.readFileSync(distIndex, 'utf-8')
		expect(source).not.toMatch(/from "@aero-js\/compiler"/)
		expect(source).not.toContain('oxc-parser')
	})
})
