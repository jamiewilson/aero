import type { ParseResult } from '../types'
import { parseHTML } from 'linkedom'

/** Ranges [start, end] of HTML comments in order. */
function getCommentRanges(html: string): [number, number][] {
	const ranges: [number, number][] = []
	const commentRegex = /<!--[\s\S]*?-->/g
	let match: RegExpExecArray | null
	while ((match = commentRegex.exec(html)) !== null) {
		ranges.push([match.index, match.index + match[0].length])
	}
	return ranges
}

function isInsideComment(pos: number, commentRanges: [number, number][]): boolean {
	return commentRanges.some(([start, end]) => pos >= start && pos < end)
}

/**
 * Parses the input HTML and extracts Aero-specific scripts.
 *
 * We use a hybrid approach: regex to find script tags in the **original** HTML
 * and linkedom to validate attributes. All removal/replacement is done by
 * character range so that comments and whitespace do not break removal.
 *
 * Script types (v2 taxonomy):
 * - `is:build`    — extracted, becomes the render function body (build-time)
 * - `is:inline`   — left in template exactly where it is (not extracted)
 * - `is:blocking` — extracted, hoisted to the <head> of the document
 * - Default       — extracted, served as virtual ES module (bundled client-side)
 */
export function parse(html: string): ParseResult {
	// Strip BOM so comment/script positions are consistent and scripts immediately
	// after comments are not wrongly treated as inside the comment.
	html = html.replace(/^\uFEFF/, '')
	const commentRanges = getCommentRanges(html)
	let buildContent: string[] = []
	let clientScripts: { attrs: string; content: string; passDataExpr?: string }[] = []
	let inlineScripts: { attrs: string; content: string; passDataExpr?: string }[] = []
	let blockingScripts: { attrs: string; content: string; passDataExpr?: string }[] = []

	// Match <script ...>...</script> in the original HTML
	const SCRIPT_REGEX = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi

	type Edit = { start: number; end: number; newContent?: string }
	const edits: Edit[] = []

	const scriptsToRemove: {
		start: number
		end: number
		type: 'build' | 'client' | 'blocking'
		content: string
		attrs: string
		passDataExpr?: string
	}[] = []

	const isInHead = (html: string, scriptStart: number): boolean => {
		const beforeScript = html.slice(0, scriptStart)
		// Match <head> tag start only (avoid matching "<head" in e.g. "<header-component")
		let headOpen = -1
		const headOpenRe = /<head(?=[\s>])/gi
		let m: RegExpExecArray | null
		while ((m = headOpenRe.exec(beforeScript)) !== null) headOpen = m.index
		// Match </head> tag
		const headClose = beforeScript.lastIndexOf('</head>')
		return headOpen > headClose
	}

	let match: RegExpExecArray | null = SCRIPT_REGEX.exec(html)
	while (match !== null) {
		const start = match.index
		const end = match.index + match[0].length
		const fullTag = match[0]
		const attrsMatch = match[1] || ''
		const content = match[2] || ''

		// Skip scripts that are inside HTML comments
		if (isInsideComment(start, commentRanges)) {
			match = SCRIPT_REGEX.exec(html)
			continue
		}

		// Parse only this script tag to check attributes with a real DOM
		const { document } = parseHTML(fullTag)
		const scriptEl = document.querySelector('script')

		if (scriptEl) {
			const passData = scriptEl.getAttribute('pass:data') || undefined

			// For is:inline scripts, we need to preserve pass:data so codegen can
			// enable interpolation. For other script types, we remove it.
			let cleanedAttrs = attrsMatch
				.replace(/\bis:build\b/g, '')
				.replace(/\bis:inline\b/g, '')
				.replace(/\bis:blocking\b/g, '')

			// Only remove pass:data from non-inline scripts (build, blocking, client)
			// Inline scripts need it preserved for codegen to process
			// Head scripts also need it preserved since they stay in place
			const inHead = isInHead(html, start)
			if (!scriptEl.hasAttribute('is:inline') && !inHead) {
				cleanedAttrs = cleanedAttrs
					.replace(/pass:data="[^"]*"/g, '')
					.replace(/pass:data='[^']*'/g, '')
					.replace(/pass:data=\{[^}]*\}/g, '')
			}

			cleanedAttrs = cleanedAttrs.replace(/\s+/g, ' ').trim()

			// Default (plain) script: opening tag in source is literally <script> or <script >,
			// so we don't rely on linkedom (script content containing "<script ...>" can
			// produce multiple elements or wrong attributes).
			const openingTag = fullTag.slice(0, fullTag.indexOf('>') + 1)
			const isPlainDefault =
				/^<script\s*>$/i.test(openingTag) && !inHead

			if (isPlainDefault) {
				scriptsToRemove.push({
					start,
					end,
					type: 'client',
					content: content.trim(),
					attrs: cleanedAttrs,
					passDataExpr: passData,
				})
				edits.push({ start, end })
			} else if (scriptEl.hasAttribute('is:build')) {
				scriptsToRemove.push({
					start,
					end,
					type: 'build',
					content: content.trim(),
					attrs: cleanedAttrs,
				})
				edits.push({ start, end })
			} else if (scriptEl.hasAttribute('is:inline')) {
				inlineScripts.push({
					attrs: cleanedAttrs,
					content: content.trim(),
					passDataExpr: passData,
				})
				edits.push({
					start,
					end,
					newContent: `<script${cleanedAttrs ? ' ' + cleanedAttrs : ''}>${content.trim()}</script>`,
				})
			} else if (scriptEl.hasAttribute('is:blocking')) {
				scriptsToRemove.push({
					start,
					end,
					type: 'blocking',
					content: content.trim(),
					attrs: cleanedAttrs,
					passDataExpr: passData,
				})
				edits.push({ start, end })
			} else if (scriptEl.hasAttribute('src')) {
				const src = scriptEl.getAttribute('src') || ''
				const isLocalScript = !src.startsWith('http://') && !src.startsWith('https://')
				const hasType = cleanedAttrs.includes('type=')

				if (isLocalScript && !hasType) {
					// defer is redundant with type=module (modules are deferred by default); strip to avoid defer="defer" in output
					// strip src from attrs since we emit it explicitly below
					const attrsForModule = cleanedAttrs
						.replace(/\bdefer\s*=\s*["'][^"']*["']/gi, '')
						.replace(/\bdefer\b/gi, '')
						.replace(/\bsrc\s*=\s*["'][^"']*["']/gi, '')
						.replace(/\s+/g, ' ')
						.trim()
					const newAttrs = attrsForModule ? attrsForModule + ' type="module"' : 'type="module"'
					edits.push({
						start,
						end,
						newContent: `<script ${newAttrs} src="${src}"></script>`,
					})
				}
			} else if (!scriptEl.hasAttribute('is:inline') && inHead) {
				// Scripts in <head> without is:inline stay in place
			} else {
				scriptsToRemove.push({
					start,
					end,
					type: 'client',
					content: content.trim(),
					attrs: cleanedAttrs,
					passDataExpr: passData,
				})
				edits.push({ start, end })
			}
		}
		match = SCRIPT_REGEX.exec(html)
	}

	// Apply all edits in one pass by character range (sorted by start)
	edits.sort((a, b) => a.start - b.start)
	let template = ''
	let last = 0
	for (const e of edits) {
		template += html.slice(last, e.start)
		if (e.newContent !== undefined) template += e.newContent
		last = e.end
	}
	template += html.slice(last)

	// Populate extracted script arrays from scriptsToRemove
	for (const s of scriptsToRemove) {
		if (s.type === 'build') buildContent.push(s.content)
		if (s.type === 'client')
			clientScripts.push({ attrs: s.attrs, content: s.content, passDataExpr: s.passDataExpr })
		if (s.type === 'blocking')
			blockingScripts.push({
				attrs: s.attrs,
				content: s.content,
				passDataExpr: s.passDataExpr,
			})
	}

	const buildScript = buildContent.length > 0 ? { content: buildContent.join('\n') } : null

	return {
		buildScript,
		clientScripts,
		inlineScripts,
		blockingScripts,
		template: template.trim(),
	}
}
