import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { applyAeroViteEnv } from '../applyAeroViteEnv'

describe('applyAeroViteEnv', () => {
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

		applyAeroViteEnv('ci', dir)

		expect(process.env.AERO_SERVER).toBe('false')
		expect(process.env.AERO_INCREMENTAL).toBe('1')

		process.env.AERO_SERVER = 'true'
		applyAeroViteEnv('ci', dir)
		expect(process.env.AERO_SERVER).toBe('true')
	})
})
