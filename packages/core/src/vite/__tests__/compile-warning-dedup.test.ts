import { describe, expect, it, vi } from 'vitest'
import { flushCompileWarnings } from '../index'

describe('flushCompileWarnings', () => {
	it('logs warnings once per unchanged source', () => {
		const hashes = new Map<string, string>()
		const log = vi.fn()
		const warning = { code: 'AERO_SWITCH', message: 'no default branch' }
		const source = '<template switch="{ x }"></template>'

		flushCompileWarnings(hashes, '/pages/about.html', source, [warning], log)
		flushCompileWarnings(hashes, '/pages/about.html', source, [warning], log)

		expect(log).toHaveBeenCalledTimes(1)
	})

	it('logs again when source changes', () => {
		const hashes = new Map<string, string>()
		const log = vi.fn()
		const warning = { code: 'AERO_SWITCH', message: 'no default branch' }

		flushCompileWarnings(hashes, '/pages/about.html', '<template switch="{ x }"></template>', [warning], log)
		flushCompileWarnings(hashes, '/pages/about.html', '<template switch="{ y }"></template>', [warning], log)

		expect(log).toHaveBeenCalledTimes(2)
	})

	it('skips empty warning batches', () => {
		const hashes = new Map<string, string>()
		const log = vi.fn()

		flushCompileWarnings(hashes, '/pages/about.html', '<div></div>', [], log)

		expect(log).not.toHaveBeenCalled()
	})
})
