/**
 * Recover original CSS file/line for Tailwind CssSyntaxError when the Vite plugin
 * drops location (URL-rewrite parse runs without compile `from`).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

type TailwindCompile = (
	css: string,
	opts: {
		base: string
		from?: string
		shouldRewriteUrls?: boolean
		onDependency?: (path: string) => void
		customCssResolver?: (id: string, base: string) => Promise<string | false | undefined>
	}
) => Promise<unknown>

interface TailwindLocSource {
	file: string
	code: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null
}

function hasTailwindLoc(err: Error): boolean {
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

function hasPostcssLoc(err: Error): boolean {
	const e = err as Error & { file?: string; line?: number; column?: number }
	return Boolean(e.file && e.line !== undefined && e.column !== undefined)
}

function resolveEntryFrom(options: EnrichCssSyntaxErrorOptions): string {
	if (typeof options.entryId === 'string' && options.entryId.length > 0) {
		const cleaned = options.entryId.replace(/^\0+/, '').split('?')[0]
		if (cleaned) {
			return path.isAbsolute(cleaned) ? cleaned : path.join(options.root, cleaned)
		}
	}
	return path.join(options.root, '__aero_css_entry.css')
}

function locatedErrorFile(err: Error): string | undefined {
	if (hasTailwindLoc(err)) {
		const loc = (err as Error & { loc?: [TailwindLocSource, number, number] }).loc
		return loc?.[0]?.file
	}
	const e = err as Error & { file?: string; input?: { file?: string } }
	return e.file ?? e.input?.file
}

function locatedLine(err: Error): number | undefined {
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

function errSource(err: Error): string | undefined {
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

function isSameFile(a: string | undefined, b: string | undefined): boolean {
	if (!a || !b) return false
	return path.normalize(a) === path.normalize(b)
}

/**
 * PostCSS often reports compiled entry CSS (`global.css:952`) while the real typo lives
 * in an imported stylesheet. Probe candidates when the located line is out of range,
 * mismatches disk, or still points at the transform entry file.
 */
function shouldProbeCssCandidates(
	err: Error,
	entryFrom: string
): boolean {
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

function isBetterLocatedError(
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

function isViteDependencyLocation(err: Error): boolean {
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

function listCssFiles(dir: string, out: string[] = []): string[] {
	let entries: string[]
	try {
		entries = readdirSync(dir)
	} catch {
		return out
	}
	for (const name of entries) {
		const full = path.join(dir, name)
		let st
		try {
			st = statSync(full)
		} catch {
			continue
		}
		if (st.isDirectory()) listCssFiles(full, out)
		else if (st.isFile() && name.endsWith('.css')) out.push(full)
	}
	return out
}

async function loadTailwindCompile(root: string): Promise<TailwindCompile | null> {
	const tryFrom = async (fromFile: string, id: string) => {
		const require = createRequire(fromFile)
		const resolved = require.resolve(id)
		const mod = (await import(pathToFileURL(resolved).href)) as { compile?: TailwindCompile }
		return typeof mod.compile === 'function' ? mod.compile : null
	}
	const packageJson = path.join(root, 'package.json')
	const cwdPackageJson = path.join(process.cwd(), 'package.json')
	for (const from of [packageJson, cwdPackageJson]) {
		try {
			return await tryFrom(from, '@tailwindcss/node')
		} catch {
			/* try via @tailwindcss/vite dependency */
		}
		try {
			const require = createRequire(from)
			const viteEntry = require.resolve('@tailwindcss/vite')
			return await tryFrom(viteEntry, '@tailwindcss/node')
		} catch {
			/* next */
		}
	}
	return null
}

function mergeViteMeta(original: Error, located: Error): Error {
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

async function compileForLocation(
	compile: TailwindCompile,
	css: string,
	from: string,
	base: string,
	resolveCss?: (id: string, importerBase: string) => Promise<string | false | undefined>
): Promise<Error | null> {
	try {
		await compile(css, {
			from,
			base,
			shouldRewriteUrls: false,
			onDependency: () => {},
			...(resolveCss
				? {
						customCssResolver: async (id, importerBase) => {
							const resolved = await resolveCss(id, importerBase)
							return resolved === undefined ? false : resolved
						},
					}
				: {
						customCssResolver: async (id, importerBase) => {
							const abs = path.isAbsolute(id) ? id : path.resolve(importerBase, id)
							try {
								if (statSync(abs).isFile()) return abs
							} catch {
								/* ignore */
							}
							return false
						},
					}),
		})
		return null
	} catch (e) {
		if (!(e instanceof Error) || e.name !== 'CssSyntaxError') return null
		if (hasTailwindLoc(e)) return e
		if (!hasPostcssLoc(e)) return null
		const located = e as Error & {
			file?: string
			line?: number
			column?: number
			source?: string
			input?: { source?: string }
		}
		const file = located.file
		const line = located.line
		const column = located.column
		const source = located.source ?? located.input?.source
		if (!file || line === undefined || column === undefined || typeof source !== 'string') {
			return null
		}
		let start = 0
		const lines = source.split(/\r?\n/)
		for (let i = 0; i < line - 1 && i < lines.length; i++) {
			start += lines[i]!.length + 1
		}
		start += Math.max(0, column - 1)
		;(e as Error & { loc?: [TailwindLocSource, number, number] }).loc = [
			{ file, code: source },
			start,
			start,
		]
		return e
	}
}

export interface EnrichCssSyntaxErrorOptions {
	root: string
	/** CSS source that failed (Vite `pluginCode` or transform `code`). */
	entryCode?: string
	/** Vite module id for the failed transform. */
	entryId?: string
	/** Extra CSS files to probe (e.g. client assets). */
	candidateFiles?: string[]
	/** Resolve `@alias` / relative CSS imports the way Vite would. */
	resolveCss?: (id: string, importerBase: string) => Promise<string | false | undefined>
}

/**
 * If `err` is a location-less Tailwind/PostCSS CssSyntaxError, recompile with `from`
 * set (and URL-rewrite disabled) so nested `@import` errors keep the original file/line.
 */
export async function enrichCssSyntaxError(
	err: unknown,
	options: EnrichCssSyntaxErrorOptions
): Promise<unknown> {
	if (!(err instanceof Error) || err.name !== 'CssSyntaxError') return err
	const tailwindLocated = hasTailwindLoc(err)
	const postcssLocated = hasPostcssLoc(err)
	const entryFrom = resolveEntryFrom(options)
	const needsCandidateProbe = shouldProbeCssCandidates(err, entryFrom)
	if ((tailwindLocated || postcssLocated) && !needsCandidateProbe) return err

	const compile = await loadTailwindCompile(options.root)
	if (!compile) return err

	const entryBase = path.dirname(entryFrom)

	if (typeof options.entryCode === 'string' && options.entryCode.length > 0) {
		const located = await compileForLocation(
			compile,
			options.entryCode,
			entryFrom.endsWith('.css') ? entryFrom : `${entryFrom}.css`,
			entryBase,
			options.resolveCss
		)
		if (located && !isViteDependencyLocation(located)) {
			if (!needsCandidateProbe || !isSameFile(locatedErrorFile(located), entryFrom)) {
				return mergeViteMeta(err, located)
			}
		}
	}

	const candidates = [...new Set(options.candidateFiles ?? [])].sort((a, b) => {
		const aEntry = isSameFile(a, entryFrom) ? 1 : 0
		const bEntry = isSameFile(b, entryFrom) ? 1 : 0
		return aEntry - bEntry
	})
	let best: Error | null = null
	for (const file of candidates) {
		let css: string
		try {
			css = readFileSync(file, 'utf8')
		} catch {
			continue
		}
		const located = await compileForLocation(compile, css, file, path.dirname(file), options.resolveCss)
		if (
			located &&
			!isViteDependencyLocation(located) &&
			isBetterLocatedError(located, best, entryFrom)
		) {
			best = located
		}
	}
	if (best && !isViteDependencyLocation(best)) {
		return mergeViteMeta(err, best)
	}

	return err
}

/** Collect `.css` files under a client assets styles directory when present. */
export function collectClientStyleCssFiles(root: string, clientDir: string): string[] {
	const stylesDir = path.join(root, clientDir, 'assets', 'styles')
	return listCssFiles(stylesDir)
}
