import { describe, expect, it } from 'vitest'
import { assertAdoptAllowed, replaceRegionWithLifecycle } from '../lifecycle-contract'

describe('runtime lifecycle contract', () => {
	it('runs compiled replacement in destroy -> swap -> remount order', () => {
		const calls: string[] = []
		const cleanup = replaceRegionWithLifecycle('compiled', {
			destroyPrevious: () => calls.push('destroy'),
			swap: () => calls.push('swap'),
			remountCompiled: () => {
				calls.push('remount')
				return () => calls.push('cleanup-compiled')
			},
			adoptRuntime: () => {
				calls.push('adopt')
				return () => calls.push('cleanup-runtime')
			},
		})

		expect(calls).toEqual(['destroy', 'swap', 'remount'])
		cleanup()
		expect(calls).toEqual(['destroy', 'swap', 'remount', 'cleanup-compiled'])
	})

	it('runs runtime replacement in destroy -> swap -> adopt order', () => {
		const calls: string[] = []
		const cleanup = replaceRegionWithLifecycle('runtime', {
			destroyPrevious: () => calls.push('destroy'),
			swap: () => calls.push('swap'),
			remountCompiled: () => {
				calls.push('remount')
				return () => calls.push('cleanup-compiled')
			},
			adoptRuntime: () => {
				calls.push('adopt')
				return () => calls.push('cleanup-runtime')
			},
		})

		expect(calls).toEqual(['destroy', 'swap', 'adopt'])
		cleanup()
		expect(calls).toEqual(['destroy', 'swap', 'adopt', 'cleanup-runtime'])
	})

	it('throws when adopt is attempted on compiled root', () => {
		expect(() => assertAdoptAllowed({ isCompiledRoot: true })).toThrow(
			/Invalid adopt\(\) call on compiled root/
		)
	})

	it('allows adopt on runtime-only containers', () => {
		expect(() => assertAdoptAllowed({ isCompiledRoot: false })).not.toThrow()
		expect(() => assertAdoptAllowed({})).not.toThrow()
	})
})
