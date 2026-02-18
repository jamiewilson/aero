import { describe, it, expect } from 'vitest'
import { compile } from '../codegen'
import { parse } from '../parser'

describe('Compiler Integration', () => {
	it('should correctly extract getStaticPaths as a named export', async () => {
		const src = `
<script on:build>
    import { something } from 'somewhere'
    
    export async function getStaticPaths() {
        return [{ params: { slug: 'a' }, props: { a: 1 } }]
    }

    const doc = Aero.props
</script>
<div>{doc.title}</div>
`
		const parsed = parse(src)
		const code = compile(parsed, { root: '/', resolvePath: s => s })

		// rudimentary check: export async function getStaticPaths should appear at top level
		// and NOT inside the default export function

		expect(code).toContain('export async function getStaticPaths() {')
		expect(code).toMatch(/export\s+async\s+function\s+getStaticPaths/)

		// Ensure it is NOT inside the default export
		// The default export starts with export default async function(Aero) {

		const defaultExportIndex = code.indexOf('export default async function(Aero)')
		const getStaticPathsIndex = code.indexOf('export async function getStaticPaths()')

		expect(getStaticPathsIndex).toBeGreaterThan(-1)
		expect(defaultExportIndex).toBeGreaterThan(-1)

		// getStaticPaths should typically be defined BEFORE default export in our codegen logic
		expect(getStaticPathsIndex).toBeLessThan(defaultExportIndex)
	})

	it('should handle getStaticPaths with complex braces in strings/comments', () => {
		const src = `
<script on:build>
    export async function getStaticPaths() {
        // { brace in comment }
        const a = "{ brace in string }"
        const b = \`{ brace in template }\`
        return [{ params: { slug: 'complex' } }]
    }
</script>
`
		const parsed = parse(src)
		const code = compile(parsed, { root: '/', resolvePath: s => s })

		expect(code).toContain('export async function getStaticPaths() {')
		expect(code).toContain('const a = "{ brace in string }"')
		expect(code).toContain('const b = \`{ brace in template }\`')
	})
})
