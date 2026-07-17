/**
 * Build a Vite-compatible source map from generated template JS back to the HTML source.
 *
 * Maps identical identifier/text slices (bare `props`, braced `{ id }`, surviving build-script
 * substrings) via MagicString.Bundle so SSR stacks remapped by Vite point at real HTML sites.
 */

import MagicString, { Bundle } from 'magic-string'

export interface TemplateSourceMapSite {
	/** Inclusive start offset in generated JS. */
	genStart: number
	/** Exclusive end offset in generated JS. */
	genEnd: number
	/** Inclusive start offset in HTML. */
	htmlStart: number
	/** Exclusive end offset in HTML. */
	htmlEnd: number
}

export interface EncodedTemplateSourceMap {
	version: 3
	file?: string
	sources: string[]
	sourcesContent?: (string | null)[]
	names: string[]
	mappings: string
}

function escapeRegExp(s: string): string {
	return s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
}

function offsetToLineCol(source: string, offset: number): { line: number; column: number } {
	let line = 1
	let column = 0
	for (let i = 0; i < offset && i < source.length; i++) {
		if (source.charCodeAt(i) === 10) {
			line++
			column = 0
		} else {
			column++
		}
	}
	return { line, column }
}

/**
 * Bare component `props` attribute (not `props="…"` / `props={…}`).
 */
export function findBarePropsAttributeOffset(html: string): number | undefined {
	const re = /<[a-zA-Z][\w:-]*\b[^>]*?\sprops(?:\s|\/>|>)/g
	for (const m of html.matchAll(re)) {
		const full = m[0]!
		const rel = full.search(/\sprops(?:\s|\/>|>)/)
		if (rel < 0) continue
		const abs = (m.index ?? 0) + rel + 1 // skip the whitespace before `props`
		const before = html.slice(0, abs).toLowerCase()
		const lastScriptOpen = before.lastIndexOf('<script')
		const lastScriptClose = before.lastIndexOf('</script>')
		if (lastScriptOpen > lastScriptClose) continue
		return abs
	}
	return undefined
}

/**
 * `{ …ident… }` template interpolations / directive values (single brace pair).
 * Skips matches that sit on a `//` line comment (e.g. `//import { createID }`).
 */
export function findBracedIdentifierOffsets(html: string, id: string): number[] {
	const re = new RegExp(`\\{[^}]*\\b${escapeRegExp(id)}\\b[^}]*\\}`, 'g')
	const idRe = new RegExp(`\\b${escapeRegExp(id)}\\b`)
	const out: number[] = []
	for (const m of html.matchAll(re)) {
		const rel = m[0]!.search(idRe)
		if (rel < 0) continue
		const abs = (m.index ?? 0) + rel
		const lineStart = html.lastIndexOf('\n', abs - 1) + 1
		const beforeOnLine = html.slice(lineStart, abs)
		if (/(?:^|[^:A-Za-z0-9_])\/\//.test(beforeOnLine) || beforeOnLine.trimStart().startsWith('//')) {
			continue
		}
		// Also treat full-line `//…` comments (trim-aware).
		const line = html.slice(lineStart, html.indexOf('\n', abs) === -1 ? html.length : html.indexOf('\n', abs))
		if (/^\s*\/\//.test(line)) continue
		out.push(abs)
	}
	return out
}

/**
 * Collect generated→HTML identical-slice sites for source map construction.
 */
export function collectTemplateSourceMapSites(
	generated: string,
	htmlSource: string
): TemplateSourceMapSite[] {
	const sites: TemplateSourceMapSite[] = []
	const usedGen = new Set<number>()

	const pushSite = (genStart: number, htmlStart: number, length: number) => {
		if (length <= 0 || usedGen.has(genStart)) return
		if (generated.slice(genStart, genStart + length) !== htmlSource.slice(htmlStart, htmlStart + length)) {
			return
		}
		usedGen.add(genStart)
		sites.push({
			genStart,
			genEnd: genStart + length,
			htmlStart,
			htmlEnd: htmlStart + length,
		})
	}

	// Bare `props` attribute → `{ ...props }` / `...props` in generated
	const bareProps = findBarePropsAttributeOffset(htmlSource)
	if (bareProps !== undefined) {
		const id = 'props'
		const spread = `...${id}`
		let from = 0
		while (from < generated.length) {
			const at = generated.indexOf(spread, from)
			if (at < 0) break
			pushSite(at + 3, bareProps, id.length)
			from = at + spread.length
		}
	}

	// Braced identifiers in HTML that also appear in generated (interpolations / exprs)
	const bracedIds = new Set<string>()
	for (const m of htmlSource.matchAll(/\{([^{}]+)\}/g)) {
		const inner = m[1] ?? ''
		for (const idM of inner.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
			bracedIds.add(idM[1]!)
		}
	}
	for (const id of bracedIds) {
		if (id === 'props' && bareProps !== undefined) continue
		const htmlOffsets = findBracedIdentifierOffsets(htmlSource, id)
		if (htmlOffsets.length === 0) continue
		const idRe = new RegExp(`\\b${escapeRegExp(id)}\\b`, 'g')
		const genOffsets: number[] = []
		for (const m of generated.matchAll(idRe)) {
			genOffsets.push(m.index ?? 0)
		}
		// Pair in order when counts match; otherwise map each gen hit to the first html site
		// (skipping entirely left caret remaps stuck on nearby mapped tokens like `length`).
		if (htmlOffsets.length === 1) {
			for (const g of genOffsets) pushSite(g, htmlOffsets[0]!, id.length)
		} else if (htmlOffsets.length === genOffsets.length) {
			for (let i = 0; i < htmlOffsets.length; i++) {
				pushSite(genOffsets[i]!, htmlOffsets[i]!, id.length)
			}
		} else if (htmlOffsets.length > 0) {
			// Order-preserving: first gen site → first html site (init throws map to the
			// first live call, not the last function that mentions the id).
			for (let i = 0; i < genOffsets.length; i++) {
				pushSite(genOffsets[i]!, htmlOffsets[Math.min(i, htmlOffsets.length - 1)]!, id.length)
			}
		}
	}

	sites.sort((a, b) => a.genStart - b.genStart)
	// Drop overlapping sites (keep earlier)
	const nonOverlap: TemplateSourceMapSite[] = []
	let lastEnd = 0
	for (const site of sites) {
		if (site.genStart < lastEnd) continue
		nonOverlap.push(site)
		lastEnd = site.genEnd
	}
	return nonOverlap
}

/**
 * Rebuild `generated` via MagicString.Bundle so mapped slices point at `htmlSource`.
 */
export function buildTemplateSourceMap(
	generated: string,
	htmlSource: string,
	sourceFileName: string
): EncodedTemplateSourceMap {
	const sites = collectTemplateSourceMapSites(generated, htmlSource)
	const bundle = new Bundle({ separator: '' })
	let cursor = 0

	for (const site of sites) {
		if (site.genStart > cursor) {
			bundle.append(generated.slice(cursor, site.genStart))
		}
		const slice = new MagicString(htmlSource)
		slice.remove(0, site.htmlStart)
		slice.remove(site.htmlEnd, htmlSource.length)
		bundle.addSource({
			filename: sourceFileName,
			content: slice,
		})
		cursor = site.genEnd
	}
	if (cursor < generated.length) {
		bundle.append(generated.slice(cursor))
	}

	const code = bundle.toString()
	if (code !== generated) {
		// Fallback: empty map rather than wrong code
		return {
			version: 3,
			sources: [sourceFileName],
			sourcesContent: [htmlSource],
			names: [],
			mappings: '',
		}
	}

	const map = bundle.generateMap({
		includeContent: true,
		hires: true,
	})
	return {
		version: 3,
		file: sourceFileName,
		sources: map.sources ?? [sourceFileName],
		sourcesContent: map.sourcesContent ?? [htmlSource],
		names: map.names ?? [],
		mappings: map.mappings ?? '',
	}
}

/** Map a generated offset to an HTML line/column via collected sites (tests). */
export function originalHtmlPositionForGeneratedOffset(
	htmlSource: string,
	sites: readonly TemplateSourceMapSite[],
	genOffset: number
): { line: number; column: number } | undefined {
	for (const site of sites) {
		if (genOffset >= site.genStart && genOffset < site.genEnd) {
			const htmlOffset = site.htmlStart + (genOffset - site.genStart)
			return offsetToLineCol(htmlSource, htmlOffset)
		}
	}
	return undefined
}

export function htmlOffsetToLineColumn(
	htmlSource: string,
	offset: number
): { line: number; column: number } {
	return offsetToLineCol(htmlSource, offset)
}
