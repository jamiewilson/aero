import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import { isAeroViteConfigEnv, loadAeroEnv, toAeroConfigEnv } from '../loadAeroEnv'

describe('loadAeroEnv', () => {
	const prev: Record<string, string | undefined> = {}

	afterEach(() => {
		for (const [key, value] of Object.entries(prev)) {
			if (value === undefined) delete process.env[key]
			else process.env[key] = value
		}
	})

	it('loads AERO_* from .env.[mode] without overwriting existing process.env', () => {
		const dir = mkdtempSync(join(tmpdir(), 'aero-env-'))
		writeFileSync(join(dir, '.env.ci'), 'AERO_SERVER=false\nAERO_INCREMENTAL=1\n')

		prev.AERO_SERVER = process.env.AERO_SERVER
		prev.AERO_INCREMENTAL = process.env.AERO_INCREMENTAL
		delete process.env.AERO_SERVER
		delete process.env.AERO_INCREMENTAL

		loadAeroEnv('ci', dir)

		expect(process.env.AERO_SERVER).toBe('false')
		expect(process.env.AERO_INCREMENTAL).toBe('1')

		process.env.AERO_SERVER = 'true'
		loadAeroEnv('ci', dir)
		expect(process.env.AERO_SERVER).toBe('true')
	})

	it('loads env from Vite defineConfig env object', () => {
		const dir = mkdtempSync(join(tmpdir(), 'aero-env-'))
		writeFileSync(join(dir, '.env.production'), 'AERO_FROM_VITE=1\n')

		prev.AERO_FROM_VITE = process.env.AERO_FROM_VITE
		delete process.env.AERO_FROM_VITE

		loadAeroEnv({ command: 'build', mode: 'production', envDir: dir })

		expect(process.env.AERO_FROM_VITE).toBe('1')
	})
})

describe('toAeroConfigEnv', () => {
	it('maps serve/build and custom Vite modes', () => {
		expect(toAeroConfigEnv({ command: 'serve', mode: 'development' })).toEqual({
			command: 'dev',
			mode: 'development',
		})
		expect(toAeroConfigEnv({ command: 'build', mode: 'ci' })).toEqual({
			command: 'build',
			mode: 'production',
		})
	})
})

describe('isAeroViteConfigEnv', () => {
	it('detects Vite env vs Aero create options', () => {
		expect(isAeroViteConfigEnv({ command: 'serve', mode: 'development' })).toBe(true)
		expect(isAeroViteConfigEnv({ command: 'build', mode: 'ci' })).toBe(true)
		expect(isAeroViteConfigEnv({ command: 'build', mode: 'production' })).toBe(false)
		expect(isAeroViteConfigEnv({ command: 'dev', mode: 'development' })).toBe(false)
	})
})
