/**
 * Ensures jiti can load aero.config.ts when it only imports the config package main entry
 * (no Vite in the dependency graph — see DISCOVERY.md).
 */
import { loadAeroConfig } from '../loadAeroConfig'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('loadAeroConfig (integration)', () => {
	it('loads kitchen-sink aero.config.ts and reads dirs', () => {
		const root = path.resolve(process.cwd(), 'examples/kitchen-sink')
		if (!fs.existsSync(path.join(root, 'aero.config.ts'))) {
			return
		}
		const cfg = loadAeroConfig(root)
		expect(cfg).not.toBeNull()
		const obj = typeof cfg === 'function' ? cfg({ command: 'build', mode: 'production' }) : cfg
		expect(obj?.dirs?.client).toBe('./frontend')
	})

	it('falls back to the next config extension when an earlier file is invalid', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-config-fallback-'))
		try {
			fs.writeFileSync(path.join(dir, 'aero.config.ts'), 'export default 123\n', 'utf-8')
			fs.writeFileSync(
				path.join(dir, 'aero.config.js'),
				'export default { server: true, dirs: { client: "src" } }\n',
				'utf-8'
			)
			const cfg = loadAeroConfig(dir)
			expect(cfg).not.toBeNull()
			const obj = typeof cfg === 'function' ? cfg({ command: 'build', mode: 'production' }) : cfg
			expect(obj?.server).toBe(true)
			expect(obj?.dirs?.client).toBe('src')
		} finally {
			fs.rmSync(dir, { recursive: true, force: true })
		}
	})
})
