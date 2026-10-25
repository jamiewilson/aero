import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { resolveNitroCliPath } from '../aero-static-build-plugin'

describe('resolveNitroCliPath', () => {
	it('resolves nitro CLI from a project with nitro installed', () => {
		const root = path.resolve(import.meta.dirname, '../../../../examples/kitchen-sink')
		const cli = resolveNitroCliPath(root)
		expect(fs.existsSync(cli)).toBe(true)
		expect(cli).toMatch(/[/\\]nitro[/\\]dist[/\\]cli[/\\]index\.mjs$/)
	})
})
