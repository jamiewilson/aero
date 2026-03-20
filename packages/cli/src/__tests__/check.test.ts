import { runAeroCheck } from '../check'
import { AERO_EXIT_COMPILE } from '@aero-js/core/diagnostics'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('runAeroCheck', () => {
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
		const code = await runAeroCheck(dir)
		expect(code).toBe(AERO_EXIT_COMPILE)
	})
})
