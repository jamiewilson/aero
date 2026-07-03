import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function packagePathsFromBumpScript(): string[] {
	const script = readFileSync(join(__dirname, 'bump-versions.js'), 'utf8')
	const start = script.indexOf('const packagePaths = [')
	if (start === -1) throw new Error('packagePaths array not found')
	const from = script.indexOf('[', start)
	const to = script.indexOf(']', from)
	const block = script.slice(from + 1, to)
	return block
		.split('\n')
		.map((line) => line.trim().replace(/^'|',?$/g, ''))
		.filter((line) => line.length > 0 && line.endsWith('package.json'))
}

describe('bump-versions.js packagePaths', () => {
	it('lists only existing package.json paths', () => {
		for (const rel of packagePathsFromBumpScript()) {
			expect(existsSync(join(root, rel)), rel).toBe(true)
		}
	})

	it('includes compiler and create', () => {
		const paths = packagePathsFromBumpScript()
		expect(paths).toContain('packages/compiler/package.json')
		expect(paths).toContain('packages/create/package.json')
		expect(paths.some((p) => p.includes('starters/'))).toBe(false)
	})
})
