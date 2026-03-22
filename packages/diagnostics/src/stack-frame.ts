/**
 * Extract file:line:column from V8-style stacks (SSR, Node, eval’d bundles).
 */

import type { AeroDiagnosticSpan } from './types'

function normalizeStackPath(raw: string): string {
	let p = raw.trim()
	if (p.startsWith('file://')) {
		p = p.slice('file://'.length)
		try {
			p = decodeURIComponent(p)
		} catch {
			// keep as-is
		}
	}
	// file:///C:/… → C:/…
	if (p.startsWith('/') && /^[A-Za-z]:\//.test(p.slice(1))) {
		p = p.slice(1)
	}
	return p
}

/** Strip `at …` preamble; path may be inside parentheses. */
function stackLineToPathCandidate(line: string): string | undefined {
	const trimmed = line.trim()
	if (!trimmed.startsWith('at ')) return undefined
	let rest = trimmed.slice(3)
	if (rest.startsWith('async ')) rest = rest.slice(6)

	const open = rest.lastIndexOf('(')
	if (open !== -1 && rest.endsWith(')')) {
		return rest.slice(open + 1, -1)
	}
	return rest
}

/**
 * First usable frame: path must exist (non-empty, not "&lt;anonymous&gt;", not "eval").
 */
export function firstStackSpan(stack: string | undefined): AeroDiagnosticSpan | undefined {
	if (stack === undefined || stack.length === 0) return undefined

	const lines = stack.split('\n')
	for (let i = 1; i < lines.length; i++) {
		const candidate = stackLineToPathCandidate(lines[i]!)
		if (!candidate) continue

		// Line:column only at the end (paths may contain ":" e.g. Windows "C:\...").
		const tail = /:(\d+):(\d+)$/.exec(candidate)
		if (!tail) continue

		const pathPart = normalizeStackPath(candidate.slice(0, candidate.length - tail[0].length))
		if (
			pathPart.length === 0 ||
			pathPart === '<anonymous>' ||
			pathPart.startsWith('eval') ||
			pathPart.includes('<anonymous>') ||
			pathPart.includes('node_modules')
		) {
			continue
		}

		const line = Number(tail[1])
		const column = Number(tail[2])
		if (!Number.isFinite(line) || line < 1) continue

		return {
			file: pathPart,
			line,
			column: Number.isFinite(column) && column >= 0 ? column : 0,
		}
	}

	return undefined
}
