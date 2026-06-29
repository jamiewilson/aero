import { describe, expect, it } from 'vitest'
import { assertProcessAllowed, replaceRegionWithLifecycle } from '../lifecycle-contract'

describe('replaceRegionWithLifecycle', () => {
	it('runs compiled replacement in destroy -> swap -> remount order', () => {
		const calls: string[] = []
		const cleanup = replaceRegionWithLifecycle('compiled', {
			destroyPrevious: () => {
				calls.push('destroy')
			},
			swap: () => {
				calls.push('swap')
			},
			remountCompiled: () => {
				calls.push('remount')
				return () => {
					calls.push('cleanup-compiled')
				}
			},
			processRuntime: () => {
				calls.push('process')
				return () => {}
			},
		})

		expect(calls).toEqual(['destroy', 'swap', 'remount'])
		cleanup()
		expect(calls).toEqual(['destroy', 'swap', 'remount', 'cleanup-compiled'])
	})

	it('runs runtime replacement in destroy -> swap -> process order', () => {
		const calls: string[] = []
		const cleanup = replaceRegionWithLifecycle('runtime', {
			destroyPrevious: () => {
				calls.push('destroy')
			},
			swap: () => {
				calls.push('swap')
			},
			remountCompiled: () => {
				calls.push('remount')
				return () => {}
			},
			processRuntime: () => {
				calls.push('process')
				return () => {
					calls.push('cleanup-runtime')
				}
			},
		})

		expect(calls).toEqual(['destroy', 'swap', 'process'])
		cleanup()
		expect(calls).toEqual(['destroy', 'swap', 'process', 'cleanup-runtime'])
	})
})

describe('assertProcessAllowed', () => {
	it('throws when process is attempted on compiled root', () => {
		expect(() => assertProcessAllowed({ isCompiledRoot: true })).toThrow(
			/Invalid process\(\) call on compiled root/
		)
	})

	it('allows process on runtime-only elements', () => {
		expect(() => assertProcessAllowed({ isCompiledRoot: false })).not.toThrow()
		expect(() => assertProcessAllowed({})).not.toThrow()
	})
})
