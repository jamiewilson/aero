import { describe, it, expect } from 'vitest'
import { checkTemplateBuildScriptTypes } from '../template-type-check'

const TYPECHECK_TIMEOUT_MS = 15_000

describe('checkTemplateBuildScriptTypes', () => {
	it(
		'returns no issues for valid build script',
		() => {
			const html = `<script is:build>
const x: number = 1
const y = x + 1
</script><p></p>`
			expect(checkTemplateBuildScriptTypes(html)).toEqual([])
		},
		TYPECHECK_TIMEOUT_MS
	)

	it(
		'reports type errors in build script',
		() => {
			const html = `<script is:build>
const x: string = 1
</script>`
			const issues = checkTemplateBuildScriptTypes(html)
			expect(issues.length).toBeGreaterThan(0)
			expect(issues[0]?.message).toMatch(/Type|assignable|number|string/i)
		},
		TYPECHECK_TIMEOUT_MS
	)

	it('returns empty when there is no build script', () => {
		expect(checkTemplateBuildScriptTypes('<p>hi</p>')).toEqual([])
	})
})
