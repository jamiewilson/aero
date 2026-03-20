import { describe, expect, it } from 'vitest'
import type { ResolvedConfig } from 'vite'
import type { AliasResult } from '../../types'
import { requireAliasResult, requireResolvedConfig } from '../plugin-state'

describe('plugin-state', () => {
	it('requireResolvedConfig throws with clear message when null', () => {
		expect(() => requireResolvedConfig({ config: null })).toThrow(
			/Vite resolved config is not available/
		)
	})

	it('requireResolvedConfig returns config when set', () => {
		const cfg = { root: '/app' } as ResolvedConfig
		expect(requireResolvedConfig({ config: cfg })).toBe(cfg)
	})

	it('requireAliasResult throws when null', () => {
		expect(() => requireAliasResult({ aliasResult: null })).toThrow(
			/path aliases are not available/
		)
	})

	it('requireAliasResult returns alias when set', () => {
		const ar: AliasResult = { resolve: (s: string) => s, aliases: [] }
		expect(requireAliasResult({ aliasResult: ar })).toBe(ar)
	})
})
