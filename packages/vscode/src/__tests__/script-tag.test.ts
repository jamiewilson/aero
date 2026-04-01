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

	it('matches permissive closing tags with trailing whitespace', () => {
		const text = '<script is:inline>console.log(1)</script >'
		const blocks = parseScriptBlocks(text)

		expect(blocks).toHaveLength(1)
		expect(blocks[0]?.content).toBe('console.log(1)')
	})

	it('matches permissive closing tags with unexpected attributes', () => {
		const text = '<script is:build>const x = 1;</script foo="bar">'
		const blocks = parseScriptBlocks(text)

		expect(blocks).toHaveLength(1)
		expect(blocks[0]?.kind).toBe('build')
		expect(blocks[0]?.content).toBe('const x = 1;')
	})
})
