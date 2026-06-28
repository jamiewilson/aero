/**
 * Regression: AeroVirtualCode build must not re-run TS inference per expression.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { AeroVirtualCode } from '../virtualCode'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..')

function createSnapshot(text: string) {
	return {
		getText: (start: number, end: number) => text.substring(start, end),
		getLength: () => text.length,
		getChangeRange: () => undefined,
	}
}

describe('AeroVirtualCode perf', () => {
	it('builds form-model.html in under 600ms', () => {
		const abs = path.join(REPO_ROOT, 'examples/kitchen-sink/client/pages/demos/form-model.html')
		const html = fs.readFileSync(abs, 'utf8')
		const runs: number[] = []
		for (let i = 0; i < 3; i++) {
			const t0 = performance.now()
			new AeroVirtualCode(createSnapshot(html), abs)
			runs.push(performance.now() - t0)
		}
		const avg = runs.reduce((a, b) => a + b, 0) / runs.length
		expect(avg).toBeLessThan(600)
	})
})
