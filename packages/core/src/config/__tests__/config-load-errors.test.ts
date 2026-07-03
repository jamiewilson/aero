import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadAeroConfigDetailed } from '../loadAeroConfig'
import { AeroConfigLoadError, configLoadErrorToDiagnostics } from '../config-load-errors'

describe('configLoadErrorToDiagnostics', () => {
	it('maps AeroConfigLoadError to AERO_CONFIG with file path', () => {
		const err = new AeroConfigLoadError(
			'[aero] aero.config must export an object or function.',
			'/proj/aero.config.ts',
			new Error('Invalid aero.config export')
		)
		const diagnostics = configLoadErrorToDiagnostics(err)
		expect(diagnostics[0]?.code).toBe('AERO_CONFIG')
		expect(diagnostics[0]?.file).toBe('/proj/aero.config.ts')
	})

	it('strict detailed load surfaces invalid export as AeroConfigLoadError', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-config-invalid-'))
		fs.writeFileSync(path.join(root, 'aero.config.ts'), 'export default 123\n', 'utf-8')
		const detailed = loadAeroConfigDetailed(root)
		expect(detailed.ok).toBe(false)
		if (detailed.ok || detailed.reason !== 'invalid-export') {
			fs.rmSync(root, { recursive: true, force: true })
			throw new Error('expected invalid-export')
		}
		const err = new AeroConfigLoadError(
			'[aero] aero.config must export an object or function.',
			detailed.filePath,
			new Error('Invalid aero.config export')
		)
		const diagnostics = configLoadErrorToDiagnostics(err)
		expect(diagnostics[0]?.code).toBe('AERO_CONFIG')
		expect(diagnostics[0]?.file).toContain('aero.config.ts')
		fs.rmSync(root, { recursive: true, force: true })
	})
})
