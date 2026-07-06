import { describe, expect, it } from 'vitest'
import {
	findCommentRange,
	emitCommentStart,
	emitCommentEnd,
	setMountTargetText,
} from '../structural/anchor'

describe('structural anchor', () => {
	it('resolves comment ranges and updates text between markers', () => {
		const host = document.createElement('div')
		host.innerHTML = `before${emitCommentStart('text', 0)}old${emitCommentEnd('text', 0)}after`
		const range = findCommentRange(host, 'text', 0)
		expect(range).not.toBeNull()
		setMountTargetText({ kind: 'comment-range', range: range! }, 'next')
		expect(host.textContent).toBe('beforenextafter')
	})
})
