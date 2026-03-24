import { describe, expect, it } from 'vitest'
import { parseRootArgs } from '../parse-cli-args'

describe('parseRootArgs', () => {
	it('defaults root to cwd and passes through subcommand', () => {
		const r = parseRootArgs(['check'])
		expect(r.ok).toBe(true)
		if (!r.ok) return
		expect(r.rest).toEqual(['check'])
		expect(r.root).toBe(process.cwd())
	})

	it('resolves --root before subcommand', () => {
		const r = parseRootArgs(['--root', '/tmp/proj', 'doctor'])
		expect(r.ok).toBe(true)
		if (!r.ok) return
		expect(r.rest).toEqual(['doctor'])
		expect(r.root.endsWith('proj')).toBe(true)
	})

	it('fails when --root is last with no path', () => {
		const r = parseRootArgs(['check', '--root'])
		expect(r.ok).toBe(false)
		if (r.ok) return
		expect(r.message).toContain('--root requires')
	})

	it('fails when value after --root is another flag', () => {
		const r = parseRootArgs(['--root', '--help'])
		expect(r.ok).toBe(false)
	})
})
