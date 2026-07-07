import { describe, expect, it } from 'vitest'
import {
	BRACE_ENTITY_CLOSE,
	BRACE_ENTITY_OPEN,
	encodeBraceCharacterReferences,
	restoreLiteralBraces,
} from '../index'

describe('encodeBraceCharacterReferences', () => {
	it('replaces numeric character references for braces with placeholders', () => {
		const encoded = encodeBraceCharacterReferences('&#123; x &#125; and &#x7B; y &#x7D;')
		expect(encoded).toBe(`${BRACE_ENTITY_OPEN} x ${BRACE_ENTITY_CLOSE} and ${BRACE_ENTITY_OPEN} y ${BRACE_ENTITY_CLOSE}`)
		expect(restoreLiteralBraces(encoded)).toBe('{ x } and { y }')
	})
})
