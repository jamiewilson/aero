import { Cause, Effect, Exit } from 'effect'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	configLoadErrorToDiagnostics,
	loadAeroConfigStrictEffect,
	resolveAeroConfigEffect,
} from '../load-aero-config-effect'

describe('resolveAeroConfigEffect', () => {
	it('resolves function config with env', () => {
		const config = Effect.runSync(
			resolveAeroConfigEffect(
				env => ({
					server: env.command === 'build',
				}),
				{ command: 'build', mode: 'production' }
			)
		)
		expect(config.server).toBe(true)
	})

	it('returns empty object when loaded config is null', () => {
		const config = Effect.runSync(
			resolveAeroConfigEffect(null, { command: 'dev', mode: 'development' })
		)
		expect(config).toEqual({})
	})

	it('applies env policy overrides when enabled', () => {
		const config = Effect.runSync(
			resolveAeroConfigEffect(
				{
					server: false,
					content: false,
					dirs: { client: 'client' },
				},
				{ command: 'dev', mode: 'development' },
				{
					applyEnvPolicy: true,
					env: {
						AERO_SERVER: 'true',
						AERO_CONTENT: '1',
						AERO_SITE_URL: 'https://example.com',
						AERO_DIR_CLIENT: 'frontend',
						AERO_DIR_SERVER: 'backend',
						AERO_DIR_DIST: 'build',
					},
				}
			)
		)
		expect(config.server).toBe(true)
		expect(config.content).toBe(true)
		expect(config.site?.url).toBe('https://example.com')
		expect(config.dirs).toEqual({
			client: 'frontend',
			server: 'backend',
			dist: 'build',
		})
	})

	it('strict load fails for invalid export and maps to AERO_CONFIG diagnostics', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-config-invalid-'))
		fs.writeFileSync(path.join(root, 'aero.config.ts'), 'export default 123\n', 'utf-8')
		const exit = Effect.runSyncExit(loadAeroConfigStrictEffect(root))
		expect(Exit.isFailure(exit)).toBe(true)
		const cause = Exit.causeOption(exit)
		const failures = cause._tag === 'Some' ? Array.from(Cause.failures(cause.value)) : []
		const err = failures[0]
		const diagnostics = configLoadErrorToDiagnostics(err)
		expect(diagnostics[0]?.code).toBe('AERO_CONFIG')
		expect(diagnostics[0]?.file).toContain('aero.config.ts')
		fs.rmSync(root, { recursive: true, force: true })
	})
})
