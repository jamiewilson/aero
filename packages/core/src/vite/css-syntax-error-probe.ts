/**
 * Tailwind compile probing to recover CssSyntaxError file/line locations.
 */

import { readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
	hasPostcssLoc,
	hasTailwindLoc,
	isBetterLocatedError,
	isSameFile,
	isViteDependencyLocation,
	locatedErrorFile,
	mergeViteMeta,
	resolveEntryFrom,
	shouldProbeCssCandidates,
	type TailwindLocSource,
} from './css-syntax-error-loc'

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
