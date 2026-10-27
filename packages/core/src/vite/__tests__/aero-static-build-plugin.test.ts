import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { resolveNitroCliPath } from '../aero-static-build-plugin'

describe('resolveNitroCliPath', () => {
	it.each([
		['kitchen-sink', '../../../../../examples/kitchen-sink'],
		['fullstack starter', '../../../../../packages/create/templates/fullstack'],
	] as const)('resolves nitro CLI from %s', (_label, relRoot) => {
		const root = path.resolve(import.meta.dirname, relRoot)
		const cli = resolveNitroCliPath(root)
		expect(fs.existsSync(cli)).toBe(true)
		expect(cli).toMatch(/[/\\](?:\.bin[/\\]nitro|nitro[/\\]dist[/\\]cli[/\\]index\.mjs)$/)
	})
})
