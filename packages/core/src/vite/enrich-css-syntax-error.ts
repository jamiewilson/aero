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
		if (e instanceof Error && e.name === 'CssSyntaxError' && hasTailwindLoc(e)) return e
		return null
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
	if (hasTailwindLoc(err) || hasPostcssLoc(err)) return err

	const compile = await loadTailwindCompile(options.root)
	if (!compile) return err

	const entryFrom =
		typeof options.entryId === 'string' && options.entryId.length > 0
			? options.entryId.replace(/^\0+/, '').split('?')[0] || path.join(options.root, '__aero_css_entry.css')
			: path.join(options.root, '__aero_css_entry.css')
	const entryBase = path.dirname(
		path.isAbsolute(entryFrom) ? entryFrom : path.join(options.root, entryFrom)
	)

	if (typeof options.entryCode === 'string' && options.entryCode.length > 0) {
		const located = await compileForLocation(
			compile,
			options.entryCode,
			entryFrom.endsWith('.css') ? entryFrom : `${entryFrom}.css`,
			entryBase,
			options.resolveCss
		)
		if (located) return mergeViteMeta(err, located)
	}

	const candidates = new Set<string>(options.candidateFiles ?? [])
	for (const file of candidates) {
		let css: string
		try {
			css = readFileSync(file, 'utf8')
		} catch {
			continue
		}
		const located = await compileForLocation(compile, css, file, path.dirname(file), options.resolveCss)
		if (located) return mergeViteMeta(err, located)
	}

	return err
}

/** Collect `.css` files under a client assets styles directory when present. */
export function collectClientStyleCssFiles(root: string, clientDir: string): string[] {
	const stylesDir = path.join(root, clientDir, 'assets', 'styles')
	return listCssFiles(stylesDir)
}
