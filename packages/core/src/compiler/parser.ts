import type { ParseResult } from '../types'
import { parseHTML } from 'linkedom'

/**
 * Parses the input HTML and extracts Aero-specific scripts.
 *
 * We use a hybrid approach: regex to find script tags and linkedom to validate
 * their attributes. This is 100% non-destructive and preserves the
 * original template structure (including doctypes and head/body tags) exactly.
 *
 * Script types (v2 taxonomy):
 * - `is:build`    — extracted, becomes the render function body (build-time)
 * - `is:inline`   — left in template exactly where it is (not extracted)
 * - `is:blocking` — extracted, hoisted to the <head> of the document
 * - Default       — extracted, served as virtual ES module (bundled client-side)
 */
export function parse(html: string): ParseResult {
	let template = html
	let buildContent: string[] = []
	let clientScripts: { attrs: string; content: string; passDataExpr?: string }[] = []
	let inlineScripts: { attrs: string; content: string; passDataExpr?: string }[] = []
	let blockingScripts: { attrs: string; content: string; passDataExpr?: string }[] = []

	// Strip HTML comments so we don't accidentally match scripts inside them
	const cleaned = html.replace(/<!--[\s\S]*?-->/g, '')

	// Match <script ...>...</script>
	const SCRIPT_REGEX = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi

	const scriptsToRemove: {
		fullTag: string
		type: 'build' | 'client' | 'blocking'
		content: string
		attrs: string
		passDataExpr?: string
	}[] = []

	const isInHead = (html: string, scriptStart: number): boolean => {
		const beforeScript = html.slice(0, scriptStart)
		const headOpen = beforeScript.lastIndexOf('<head')
		const headClose = beforeScript.lastIndexOf('</head')
		//console.log('[PARSER isInHead] headOpen:', headOpen, 'headClose:', headClose, 'result:', headOpen > headClose, 'beforeScript snippet:', beforeScript.slice(-50))
		return headOpen > headClose
	}

	let match: RegExpExecArray | null = SCRIPT_REGEX.exec(cleaned)
	while (match !== null) {
		const fullTag = match[0]
		const attrsMatch = match[1] || ''
		const content = match[2] || ''
		const scriptStart = match.index

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
			const inHead = isInHead(html, match.index)
			if (!scriptEl.hasAttribute('is:inline') && !inHead) {
				cleanedAttrs = cleanedAttrs
					.replace(/pass:data="[^"]*"/g, '')
					.replace(/pass:data='[^']*'/g, '')
					.replace(/pass:data=\{[^}]*\}/g, '')
			}

			cleanedAttrs = cleanedAttrs.replace(/\s+/g, ' ').trim()

			if (scriptEl.hasAttribute('is:build')) {
				scriptsToRemove.push({
					fullTag,
					type: 'build',
					content: content.trim(),
					attrs: cleanedAttrs,
				})
			} else if (scriptEl.hasAttribute('is:inline')) {
				// is:inline stays in the DOM where it was written.
				// We don't remove it from `template`, but we track it so codegen can process passData.
				inlineScripts.push({
					attrs: cleanedAttrs,
					content: content.trim(),
					passDataExpr: passData,
				})

				// Rewrite the tag to remove the directives like `is:inline`
				template = template.replace(
					fullTag,
					`<script${cleanedAttrs ? ' ' + cleanedAttrs : ''}>${content.trim()}</script>`,
				)
			} else if (scriptEl.hasAttribute('is:blocking')) {
				scriptsToRemove.push({
					fullTag,
					type: 'blocking',
					content: content.trim(),
					attrs: cleanedAttrs,
					passDataExpr: passData,
				})
			} else if (scriptEl.hasAttribute('src')) {
				// External scripts with src stay in place - don't extract
				// For local scripts (not absolute URLs), add type="module" if not specified
				// This ensures Vite can properly bundle/transform the import statements
				const src = scriptEl.getAttribute('src') || ''
				const isLocalScript = !src.startsWith('http://') && !src.startsWith('https://')
				const hasType = cleanedAttrs.includes('type=')

				if (isLocalScript && !hasType) {
					// Add type="module" for local scripts without explicit type
					const newAttrs = cleanedAttrs ? cleanedAttrs + ' type="module"' : 'type="module"'
					template = template.replace(fullTag, `<script ${newAttrs} src="${src}"></script>`)
				}
			} else if (!scriptEl.hasAttribute('is:inline') && isInHead(html, scriptStart)) {
				// Scripts in <head> without is:inline stay in place (same as external src scripts)
				// They are not extracted or hoisted - they're left where they are in the template
				//console.log('[PARSER] Head script stays in place, template should contain pass:data')
			} else {
				// Default is bundled client script
				scriptsToRemove.push({
					fullTag,
					type: 'client',
					content: content.trim(),
					attrs: cleanedAttrs,
					passDataExpr: passData,
				})
			}
		}
		match = SCRIPT_REGEX.exec(cleaned)
	}

	// Remove identified scripts from the template string
	//console.log('[PARSER] scriptsToRemove length:', scriptsToRemove.length)
	for (const s of scriptsToRemove) {
		//console.log('[PARSER] Removing script, type:', s.type, 'has passDataExpr:', !!s.passDataExpr, 'content preview:', s.content.substring(0, 30))
		template = template.replace(s.fullTag, '')
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
