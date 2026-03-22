/**
 * Ensures jiti can load aero.config.ts when it only imports the config package main entry
 * (no Vite in the dependency graph — see DISCOVERY.md).
 */
import { loadAeroConfig } from '../loadAeroConfig'
import fs from 'node:fs'
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
})
