import { describe, expect, it } from 'vitest'
import { normalizeParseErrorFrame } from '../frame-normalize'

describe('normalizeParseErrorFrame', () => {
	it('dedents embedded template/CSS lines (caret aligned)', () => {
		const frame = [
			'12 |  __out += `',
			`13 |\t\t@scope \${`,
			`14 |\t\t\t:scope {`,
			'   |     ^',
		].join('\n')
		const out = normalizeParseErrorFrame(frame, 14)
		expect(out).toContain('12 |  __out += `')
		expect(out).toContain('@scope ${')
		expect(out).toContain(':scope {')
		expect(out).not.toContain('\t\t\t:scope')
		const caretLine = out.split('\n').find(l => l.includes('^')) ?? ''
		expect(caretLine).toMatch(/^\s*\|\s+\^/)
		expect(out).not.toMatch(/\t/)
	})

	it('expands nested template lines to spaces', () => {
		const t = '\t'
		const frame = [
			'12 |  __out += `',
			`14 | ${t}${t}${t}:scope {`,
			`15 | ${t}${t}${t}${t}display: block;`,
		].join('\n')
		const out = normalizeParseErrorFrame(frame, 14)
		expect(out).not.toMatch(/\t/)
		expect(out).toContain(':scope {')
		expect(out).toContain('display: block;')
		const padAfterPipe = (line: string) => {
			const m = /^\d+\s+\|\s(.*)$/.exec(line)
			if (!m?.[1]) return 0
			let n = 0
			for (const c of m[1]) {
				if (c === ' ') n++
				else break
			}
			return n
		}
		const scopeLine = out.split('\n').find(l => l.includes(':scope')) ?? ''
		const propLine = out.split('\n').find(l => l.includes('display')) ?? ''
		expect(padAfterPipe(propLine)).toBeGreaterThan(padAfterPipe(scopeLine))
	})
})
