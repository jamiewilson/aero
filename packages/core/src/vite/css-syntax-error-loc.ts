/**
 * Location predicates and ranking for Tailwind/PostCSS CssSyntaxError enrichment.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'

export type TailwindLocSource = {
	file: string
	code: string
}

export function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null
}

export function hasTailwindLoc(err: Error): boolean {
	const loc = (err as Error & { loc?: unknown }).loc
	if (!Array.isArray(loc) || loc.length < 2) return false
	const head = loc[0]
	return (
		isRecord(head) &&
		typeof head.file === 'string' &&
		typeof head.code === 'string' &&
		typeof loc[1] === 'number'
	)
}

export function hasPostcssLoc(err: Error): boolean {
	const e = err as Error & { file?: string; line?: number; column?: number }
	return Boolean(e.file && e.line !== undefined && e.column !== undefined)
}

export function resolveEntryFrom(options: {
	root: string
	entryId?: string
}): string {
	if (typeof options.entryId === 'string' && options.entryId.length > 0) {
		const cleaned = options.entryId.replace(/^\0+/, '').split('?')[0]
		if (cleaned) {
			return path.isAbsolute(cleaned) ? cleaned : path.join(options.root, cleaned)
		}
	}
	return path.join(options.root, '__aero_css_entry.css')
}

export function locatedErrorFile(err: Error): string | undefined {
	if (hasTailwindLoc(err)) {
		const loc = (err as Error & { loc?: [TailwindLocSource, number, number] }).loc
		return loc?.[0]?.file
	}
	const e = err as Error & { file?: string; input?: { file?: string } }
	return e.file ?? e.input?.file
}

export function locatedLine(err: Error): number | undefined {
	if (hasTailwindLoc(err)) {
		const loc = (err as Error & { loc?: [TailwindLocSource, number, number] }).loc
		const code = loc?.[0]?.code
		const start = loc?.[1]
		if (typeof code === 'string' && typeof start === 'number') {
			let line = 1
			for (let i = 0; i < start && i < code.length; i++) {
				if (code.charCodeAt(i) === 10) line++
			}
			return line
		}
	}
	const e = err as Error & { line?: number; input?: { line?: number } }
	return e.line ?? e.input?.line
}

export function errSource(err: Error): string | undefined {
	const e = err as Error & {
		source?: string
		input?: { source?: string }
		loc?: [TailwindLocSource, number, number]
	}
	if (typeof e.source === 'string' && e.source.length > 0) return e.source
	if (typeof e.input?.source === 'string' && e.input.source.length > 0) return e.input.source
	if (hasTailwindLoc(err)) return e.loc?.[0]?.code
	return undefined
}

export function isSameFile(a: string | undefined, b: string | undefined): boolean {
	if (!a || !b) return false
	return path.normalize(a) === path.normalize(b)
}

/**
 * PostCSS often reports compiled entry CSS (`global.css:952`) while the real typo lives
 * in an imported stylesheet. Probe candidates when the located line is out of range,
 * mismatches disk, or still points at the transform entry file.
 */
export function shouldProbeCssCandidates(err: Error, entryFrom: string): boolean {
	if (!hasTailwindLoc(err) && !hasPostcssLoc(err)) return true

	const file = locatedErrorFile(err)
	if (!file) return true
	if (file.includes('/node_modules/.vite/deps/')) return true
	if (isSameFile(file, entryFrom)) return true

	const line = locatedLine(err)
	if (line === undefined) return false

	try {
		const diskLines = readFileSync(file, 'utf8').split(/\r?\n/)
		if (line > diskLines.length) return true
		const source = errSource(err)
		if (!source || line < 1) return false
		const sourceLine = source.split(/\r?\n/)[line - 1]
		const diskLine = diskLines[line - 1]
		if (
			sourceLine !== undefined &&
			diskLine !== undefined &&
			sourceLine.trim() !== diskLine.trim()
		) {
			return true
		}
	} catch {
		return true
	}

	return false
}

export function isViteDependencyLocation(err: Error): boolean {
	const e = err as Error & {
		file?: string
		id?: string
		loc?: [TailwindLocSource, number, number]
	}
	const locFile = Array.isArray(e.loc) && isRecord(e.loc[0]) ? e.loc[0].file : undefined
	return [e.file, e.id, locFile].some(
		file => typeof file === 'string' && file.includes('/node_modules/.vite/deps/')
	)
}

export function isBetterLocatedError(
	candidate: Error,
	current: Error | null,
	entryFrom: string
): boolean {
	if (isViteDependencyLocation(candidate)) return false
	const candidateFile = locatedErrorFile(candidate)
	if (!candidateFile) return false
	if (!current || isViteDependencyLocation(current)) return true
	const currentFile = locatedErrorFile(current)
	if (!currentFile) return true
	const candidateIsEntry = isSameFile(candidateFile, entryFrom)
	const currentIsEntry = isSameFile(currentFile, entryFrom)
	if (currentIsEntry && !candidateIsEntry) return true
	return false
}

export function mergeViteMeta(original: Error, located: Error): Error {
	const o = original as Error & Record<string, unknown>
	const l = located as Error & { loc?: [TailwindLocSource, number, number] }
	const file = Array.isArray(l.loc) && isRecord(l.loc[0]) ? String(l.loc[0].file) : undefined
	const code =
		Array.isArray(l.loc) && isRecord(l.loc[0]) && typeof l.loc[0].code === 'string'
			? l.loc[0].code
			: undefined
	const start = Array.isArray(l.loc) && typeof l.loc[1] === 'number' ? l.loc[1] : undefined
	const out = new Error(l.message) as Error & Record<string, unknown>
	out.name = 'CssSyntaxError'
	out.loc = l.loc
	if (file) {
		out.id = file
		out.file = file
		if (code !== undefined && start !== undefined) {
			// PostCSS-shaped fields survive Vite wrappers that drop Tailwind's loc tuple.
			let line = 1
			let lineStart = 0
			for (let i = 0; i < start && i < code.length; i++) {
				if (code.charCodeAt(i) === 10) {
					line++
					lineStart = i + 1
				}
			}
			out.line = line
			out.column = start - lineStart + 1
			out.source = code
		}
	} else if (typeof o.id === 'string') {
		out.id = o.id
	}
	if (typeof o.plugin === 'string') out.plugin = o.plugin
	return out
}
