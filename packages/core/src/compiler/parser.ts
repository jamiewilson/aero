import type { ParseResult, ScriptEntry } from '../types'
import { parseHTML } from 'linkedom'
import * as CONST from './constants'

/** Serialize element attributes to a string, excluding given names (case-insensitive). Values are XML-escaped. */
function getAttrsString(
	element: Element,
	exclude: Set<string>,
): string {
	const parts: string[] = []
	const attrs = (element as any).attributes
	if (!attrs) return ''
	const excludeLower = new Set([...exclude].map(s => s.toLowerCase()))
	for (let i = 0; i < attrs.length; i++) {
		const a = attrs[i]
		if (!a || excludeLower.has(a.name.toLowerCase())) continue
		const value = a.value
		const escaped = value
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
		parts.push(`${a.name}="${escaped}"`)
	}
	return parts.join(' ').trim()
}

/** True if element is inside SVG or MathML (foreign content). */
function isInForeignNamespace(el: Element): boolean {
	let parent = el.parentElement
	while (parent) {
		const tag = parent.tagName?.toLowerCase()
		if (tag === 'svg' || tag === 'math') return true
		parent = parent.parentElement
	}
	return false
}

/** True if element is inside <head>. */
function isInHead(el: Element): boolean {
	let parent = el.parentElement
	while (parent) {
		if (parent.tagName?.toLowerCase() === 'head') return true
		parent = parent.parentElement
	}
	return false
}

/** Collect all <script> elements in document order that are not inside SVG/MathML. */
function collectScriptElements(doc: Document): Element[] {
	const scripts: Element[] = []
	const walk = (node: Node) => {
		if (node.nodeType === 1) {
			const el = node as Element
			if (el.tagName?.toLowerCase() === 'script') {
				if (!isInForeignNamespace(el)) scripts.push(el)
				return
			}
		}
		for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i])
	}
	// Walk from document root so we collect scripts in head, body, and any before <html> (e.g. is:build)
	walk(doc)
	return scripts
}

/**
 * Parse HTML and extract Aero script blocks; return build script, client/inline/blocking script arrays, and template.
 *
 * @remarks
 * DOM-first approach: parse full document with linkedom, walk script elements (skipping SVG/MathML),
 * classify by attributes (is:build, is:inline, is:blocking, src, pass:data), mutate DOM (remove/replace),
 * then serialize to produce template. Scripts inside HTML comments are not in the DOM and are left in place.
 * BOM is stripped first.
 *
 * @param html - Full template HTML (may include BOM).
 * @returns ParseResult with buildScript, clientScripts, inlineScripts, blockingScripts, and template (script blocks removed/replaced).
 */
export function parse(html: string): ParseResult {
	html = html.replace(/^\uFEFF/, '')

	// Expand non-void self-closing tags so the HTML5 parser (linkedom) builds correct DOM.
	// Otherwise e.g. <nav-component /> is parsed as opening-only and swallows following siblings.
	html = html.replace(CONST.SELF_CLOSING_TAG_REGEX, (match, tagName, attrs) => {
		const tag = String(tagName).toLowerCase()
		if (CONST.VOID_TAGS.has(tag)) return match
		return `<${tagName}${attrs}></${tagName}>`
	})

	const isFullDocument = /<\s*html[\s>]/i.test(html)
	let doc: Document
	if (isFullDocument) {
		const parsed = parseHTML(html)
		doc = parsed.document
	} else {
		const parsed = parseHTML(`<html><head></head><body>${html}</body></html>`)
		doc = parsed.document
	}

	const buildContent: string[] = []
	const clientScripts: ScriptEntry[] = []
	const inlineScripts: ScriptEntry[] = []
	const blockingScripts: ScriptEntry[] = []

	const scriptElements = collectScriptElements(doc)
	const toRemove: Element[] = []

	for (const scriptEl of scriptElements) {
		const inHead = isInHead(scriptEl)
		const hasBuild = scriptEl.hasAttribute(CONST.ATTR_IS_BUILD)
		const hasInline = scriptEl.hasAttribute(CONST.ATTR_IS_INLINE)
		const hasBlocking = scriptEl.hasAttribute(CONST.ATTR_IS_BLOCKING)
		const src = scriptEl.getAttribute(CONST.ATTR_SRC) ?? ''
		const passData = scriptEl.getAttribute(CONST.ATTR_PASS_DATA) ?? undefined

		const attrsExcludeTaxonomy = new Set([CONST.ATTR_IS_BUILD, CONST.ATTR_IS_INLINE, CONST.ATTR_IS_BLOCKING])
		let cleanedAttrs = getAttrsString(scriptEl, attrsExcludeTaxonomy)
		if (!hasInline && !inHead) {
			cleanedAttrs = getAttrsString(scriptEl, new Set([...attrsExcludeTaxonomy, CONST.ATTR_PASS_DATA]))
		}
		cleanedAttrs = cleanedAttrs.replace(/\s+/g, ' ').trim()

		const content = (scriptEl.textContent ?? '').trim()

		if (hasBuild) {
			buildContent.push(content)
			toRemove.push(scriptEl)
			continue
		}
		if (hasInline) {
			inlineScripts.push({
				attrs: cleanedAttrs,
				content,
				passDataExpr: passData,
			})
			// Strip is:inline in place so serialized template has clean script tag
			scriptEl.removeAttribute(CONST.ATTR_IS_INLINE)
			continue
		}
		if (hasBlocking) {
			blockingScripts.push({
				attrs: cleanedAttrs,
				content,
				passDataExpr: passData,
			})
			toRemove.push(scriptEl)
			continue
		}
		if (src) {
			const isLocal = !src.startsWith('http://') && !src.startsWith('https://')
			const hasType = scriptEl.hasAttribute('type')
			if (isLocal && !hasType) {
				// Mutate in place: add type=module, strip defer (redundant with module)
				scriptEl.setAttribute('type', 'module')
				scriptEl.removeAttribute('defer')
			}
			continue
		}
		// Script in head with attributes (e.g. pass:data) but not is:inline stays in place
		if (inHead && scriptEl.attributes.length > 0) continue
		// Plain script (no attrs or body): extract as client
		clientScripts.push({
			attrs: cleanedAttrs,
			content,
			passDataExpr: passData,
			injectInHead: inHead,
		})
		toRemove.push(scriptEl)
	}

	for (const el of toRemove) el.remove()

	const buildScript = buildContent.length > 0 ? { content: buildContent.join('\n') } : null

	let template: string
	if (isFullDocument) {
		template = doc.documentElement ? doc.documentElement.outerHTML : String(doc)
	} else {
		template = doc.body ? doc.body.innerHTML : ''
	}

	return {
		buildScript,
		clientScripts,
		inlineScripts,
		blockingScripts,
		template: template.trim(),
	}
}