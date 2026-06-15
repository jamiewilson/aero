import { describe, expect, it, vi } from 'vitest'
import { CompileWarningDeduper } from '../compile-warning-dedup'

describe('CompileWarningDeduper', () => {
	it('logs warnings once per unchanged source', () => {
		const deduper = new CompileWarningDeduper()
		const log = vi.fn()
		const warning = { code: 'AERO_SWITCH', message: 'no default branch' }
		const source = '<template switch="{ x }"></template>'

		deduper.flushWarnings('/pages/about.html', source, [warning], log)
		deduper.flushWarnings('/pages/about.html', source, [warning], log)

		expect(log).toHaveBeenCalledTimes(1)
	})

	it('logs again when source changes', () => {
		const deduper = new CompileWarningDeduper()
		const log = vi.fn()
		const warning = { code: 'AERO_SWITCH', message: 'no default branch' }

		deduper.flushWarnings('/pages/about.html', '<template switch="{ x }"></template>', [warning], log)
		deduper.flushWarnings('/pages/about.html', '<template switch="{ y }"></template>', [warning], log)

		expect(log).toHaveBeenCalledTimes(2)
	})

	it('skips empty warning batches', () => {
		const deduper = new CompileWarningDeduper()
		const log = vi.fn()

		deduper.flushWarnings('/pages/about.html', '<div></div>', [], log)

		expect(log).not.toHaveBeenCalled()
	})
})
