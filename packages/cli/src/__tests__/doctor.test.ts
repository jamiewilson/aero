import {
	runAeroDoctor,
	AERO_DOCTOR_MIN_NODE_MAJOR,
	nodeMeetsAeroMinimum,
} from '../doctor'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('nodeMeetsAeroMinimum', () => {
	it('accepts current major and rejects below minimum', () => {
		expect(nodeMeetsAeroMinimum(process.versions.node)).toBe(true)
		expect(nodeMeetsAeroMinimum(`${AERO_DOCTOR_MIN_NODE_MAJOR}.0.0`)).toBe(
			true
		)
		expect(nodeMeetsAeroMinimum(`${AERO_DOCTOR_MIN_NODE_MAJOR - 1}.99.0`)).toBe(
			false
		)
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

			const code = runAeroDoctor(dir)
			expect(code).toBe(0)
		} finally {
			fs.rmSync(dir, { recursive: true, force: true })
		}
	})
})
