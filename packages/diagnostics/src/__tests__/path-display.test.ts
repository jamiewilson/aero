import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { collapsePathSlashes, diagnosticPathForDisplay } from '../path-display'

describe('path-display', () => {
	it('collapsePathSlashes merges slashes', () => {
		expect(collapsePathSlashes('/a/b//c///d')).toBe('/a/b/c/d')
	})

	it('diagnosticPathForDisplay is relative under cwd', () => {
		const p = path.join(process.cwd(), 'packages/core/foo.ts')
		expect(diagnosticPathForDisplay(p).replace(/\\/g, '/')).toMatch(/^packages\/core\/foo\.ts$/)
	})

	it('diagnosticPathForDisplay leaves already-relative paths', () => {
		expect(diagnosticPathForDisplay('client/pages/a.html')).toBe('client/pages/a.html')
	})
})
