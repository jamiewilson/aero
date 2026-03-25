import { describe, expect, it } from 'vitest'
import { parseScriptBlocks } from '../script-tag'

describe('parseScriptBlocks', () => {
	it('computes contentStart after opening tag end when body is empty', () => {
		const text = 'a<script is:build></script>b'
		const blocks = parseScriptBlocks(text)
		expect(blocks).toHaveLength(1)

		const block = blocks[0]!
		const expectedTagStart = text.indexOf('<script')
		const expectedOpeningTagEnd = text.indexOf('>') + 1

		expect(block.content).toBe('')
		expect(block.tagStart).toBe(expectedTagStart)
		expect(block.contentStart).toBe(expectedOpeningTagEnd)
		expect(block.contentStart).not.toBe(block.tagStart)
	})
})
