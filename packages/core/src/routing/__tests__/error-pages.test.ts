import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	ERROR_PAGE_NAME,
	ERROR_PRERENDER_PASSES,
	isErrorPageName,
	resolveErrorTemplatePath,
} from '../error-pages'

describe('error-pages', () => {
	it('identifies the reserved error page name', () => {
		expect(isErrorPageName('error')).toBe(true)
		expect(isErrorPageName('about')).toBe(false)
		expect(ERROR_PAGE_NAME).toBe('error')
	})

	it('defines required prerender passes for 404 and 500 artifacts', () => {
		expect(ERROR_PRERENDER_PASSES).toEqual([
			{ status: 404, message: 'Page not found', outputFile: '404.html' },
			{ status: 500, message: 'Internal server error', outputFile: '500.html' },
		])
	})

	it('resolves the error template path under client/pages', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-error-path-'))
		try {
			const templatePath = path.join(root, 'client', 'pages', 'error.html')
			fs.mkdirSync(path.dirname(templatePath), { recursive: true })
			fs.writeFileSync(templatePath, '<html></html>')
			expect(resolveErrorTemplatePath(root, 'client')).toBe(templatePath)
		} finally {
			fs.rmSync(root, { recursive: true, force: true })
		}
	})
})
