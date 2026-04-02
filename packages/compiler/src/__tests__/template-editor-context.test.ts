import { describe, it, expect } from 'vitest'
import { buildTemplateEditorAmbient } from '../template-editor-context'
import { parse } from '../parser'

describe('buildTemplateEditorAmbient', () => {
	it('matches parse() merged build script and collects bindings', () => {
		const html = `<script is:build>
const title = 'x'
</script><p>{title}</p>`
		const parsed = parse(html)
		const ambient = buildTemplateEditorAmbient(html)
		expect(parsed.buildScript?.content.trim()).toBe(ambient.buildScriptBodies[0]?.trim())
		expect(ambient.bindingNames.has('title')).toBe(true)
	})

	it('merges multiple is:build scripts like parse()', () => {
		const html = `<script is:build>const a = 1</script>
<script is:build>const b = a + 1</script>`
		const parsed = parse(html)
		const ambient = buildTemplateEditorAmbient(html)
		expect(ambient.buildScriptBodies[0]).toBe(parsed.buildScript?.content)
		expect(ambient.bindingNames.has('a')).toBe(true)
		expect(ambient.bindingNames.has('b')).toBe(true)
	})
})
