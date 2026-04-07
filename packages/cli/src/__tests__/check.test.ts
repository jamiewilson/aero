import { runAeroCheck } from '../check'
import { AERO_EXIT_COMPILE, AERO_EXIT_ROUTE } from '@aero-js/core/diagnostics'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

describe('runAeroCheck', () => {
	it('returns non-zero when --types and build script has a type error', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-check-types-'))
		fs.mkdirSync(path.join(dir, 'client/pages'), { recursive: true })
		fs.writeFileSync(
			path.join(dir, 'client/pages/bad-types.html'),
			'<script is:build>\nconst x: string = 1\n</script><p></p>\n',
			'utf-8'
		)
		const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true as any)
		try {
			const code = await runAeroCheck(dir, { types: true })
			expect(code).toBe(AERO_EXIT_COMPILE)
			const out = spy.mock.calls.map(args => String(args[0])).join('')
			expect(out).toContain('AERO_BUILD_SCRIPT')
		} finally {
			spy.mockRestore()
		}
	})

	it('returns 0 for a minimal valid HTML page', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-check-'))
		fs.mkdirSync(path.join(dir, 'client/pages'), { recursive: true })
		fs.writeFileSync(
			path.join(dir, 'client/pages/index.html'),
			'<!DOCTYPE html><html><body><p>ok</p></body></html>\n',
			'utf-8'
		)
		const code = await runAeroCheck(dir)
		expect(code).toBe(0)
	})

	it('returns 1 when a template has an invalid props directive', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-check-'))
		fs.mkdirSync(path.join(dir, 'client/pages'), { recursive: true })
		fs.writeFileSync(
			path.join(dir, 'client/pages/bad.html'),
			'<script is:build></script><div props="not-braced">x</div>\n',
			'utf-8'
		)
		const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true as any)
		try {
			const code = await runAeroCheck(dir)
			expect(code).toBe(AERO_EXIT_COMPILE)
		} finally {
			spy.mockRestore()
		}
	})

	it('prints AERO code/message and returns matching compile exit bucket', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-check-'))
		fs.mkdirSync(path.join(dir, 'client/pages'), { recursive: true })
		fs.writeFileSync(
			path.join(dir, 'client/pages/bad.html'),
			'<script is:build></script><div props="not-braced">x</div>\n',
			'utf-8'
		)
		const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true as any)
		try {
			const code = await runAeroCheck(dir)
			expect(code).toBe(AERO_EXIT_COMPILE)
			const out = spy.mock.calls.map(args => String(args[0])).join('')
			expect(out).toContain('[AERO_COMPILE]')
			expect(out).toContain('Directive `props` on <div> must use a braced expression')
			const normalized = out.replace(
				new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
				'<TMP>'
			)
			expect(normalized).toMatchInlineSnapshot(`
				"[aero] [AERO_COMPILE] <TMP>/client/pages/bad.html:1:31
				  error: Directive \`props\` on <div> must use a braced expression, e.g. props="{ expression }".
				"
			`)
		} finally {
			spy.mockRestore()
		}
	})

	it('prints template/switch compiler warnings but still returns 0', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-check-warn-'))
		fs.mkdirSync(path.join(dir, 'client/pages'), { recursive: true })
		fs.writeFileSync(
			path.join(dir, 'client/pages/warn.html'),
			'<template if="{ ok }" class="panel"><p>x</p></template><div switch="{ state }"><p case="a">a</p><p case="a">dup</p></div>\n',
			'utf-8'
		)
		const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true as any)
		try {
			const code = await runAeroCheck(dir)
			expect(code).toBe(0)
			const out = spy.mock.calls.map(args => String(args[0])).join('')
			expect(out).toContain('[AERO_TEMPLATE]')
			expect(out).toContain('[AERO_SWITCH]')
			expect(out).toContain('warning:')
		} finally {
			spy.mockRestore()
		}
	})

	it('reports duplicate route-path collisions as AERO_ROUTE errors', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-check-route-collision-'))
		fs.mkdirSync(path.join(dir, 'client/pages/a'), { recursive: true })
		fs.writeFileSync(path.join(dir, 'client/pages/a/index.html'), '<p>a</p>\n', 'utf-8')
		fs.writeFileSync(path.join(dir, 'client/pages/a.html'), '<p>b</p>\n', 'utf-8')
		const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true as any)
		try {
			const code = await runAeroCheck(dir)
			expect(code).toBe(AERO_EXIT_ROUTE)
			const out = spy.mock.calls.map(args => String(args[0])).join('')
			expect(out).toContain('[AERO_ROUTE]')
			expect(out).toContain('Duplicate route path')
		} finally {
			spy.mockRestore()
		}
	})

	it('reports unsupported route segment syntax as AERO_ROUTE errors', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-check-route-unsupported-'))
		fs.mkdirSync(path.join(dir, 'client/pages/docs'), { recursive: true })
		fs.writeFileSync(path.join(dir, 'client/pages/docs/[...slug].html'), '<p>x</p>\n', 'utf-8')
		const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true as any)
		try {
			const code = await runAeroCheck(dir)
			expect(code).toBe(AERO_EXIT_ROUTE)
			const out = spy.mock.calls.map(args => String(args[0])).join('')
			expect(out).toContain('[AERO_ROUTE]')
			expect(out).toContain('Unsupported route segment')
		} finally {
			spy.mockRestore()
		}
	})
})
