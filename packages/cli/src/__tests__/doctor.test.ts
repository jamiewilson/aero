import { runAeroDoctor, AERO_DOCTOR_MIN_NODE_MAJOR, nodeMeetsAeroMinimum } from '../doctor'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

describe('nodeMeetsAeroMinimum', () => {
	it('accepts current major and rejects below minimum', () => {
		expect(nodeMeetsAeroMinimum(process.versions.node)).toBe(true)
		expect(nodeMeetsAeroMinimum(`${AERO_DOCTOR_MIN_NODE_MAJOR}.0.0`)).toBe(true)
		expect(nodeMeetsAeroMinimum(`${AERO_DOCTOR_MIN_NODE_MAJOR - 1}.99.0`)).toBe(false)
	})
})

describe('runAeroDoctor', () => {
	it('returns 0 when Node meets the minimum (typical CI/dev)', () => {
		const major = parseInt(process.versions.node.split('.')[0]!, 10)
		expect(major).toBeGreaterThanOrEqual(AERO_DOCTOR_MIN_NODE_MAJOR)

		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-doctor-'))
		try {
			fs.writeFileSync(
				path.join(dir, 'package.json'),
				JSON.stringify({
					devDependencies: { vite: '^8.0.0', '@aero-js/core': 'workspace:*' },
				}),
				'utf-8'
			)

			const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any)
			try {
				const code = runAeroDoctor(dir)
				expect(code).toBe(0)
				expect(spy).toHaveBeenCalled()
				const out = spy.mock.calls.map(args => String(args[0])).join('')
				expect(out).toContain('[ok]')
			} finally {
				spy.mockRestore()
			}
		} finally {
			fs.rmSync(dir, { recursive: true, force: true })
		}
	})
})
