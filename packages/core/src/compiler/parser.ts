import type { ParseResult } from '../types'
import { parseHTML } from 'linkedom'

/**
 * Parses the input HTML and extracts Aero-specific scripts.
 *
 * We use a hybrid approach: regex to find script tags and linkedom to validate
 * their attributes. This is 100% non-destructive and preserves the
 * original template structure (including doctypes and head/body tags) exactly.
 *
 * Script types:
 * - `is:build`   — extracted, becomes the render function body (build-time)
 * - `is:bundled`  — extracted, served as virtual ES module (client-side)
 * - `is:inline`  — left in template, rendered inline (client-side)
 */
export function parse(html: string): ParseResult {
	let template = html
	let buildContent: string[] = []
	let clientContent: string[] = []
	let clientPassData: string | undefined

	// Strip HTML comments so we don't accidentally match scripts inside them
	const cleaned = html.replace(/<!--[\s\S]*?-->/g, '')

	// Match <script ...>...</script>
	const SCRIPT_REGEX = /<script\b[^>]*>([\s\S]*?)<\/script>/gi

	const scriptsToRemove: { fullTag: string; type: 'build' | 'client'; content: string }[] = []

	let match
	while ((match = SCRIPT_REGEX.exec(cleaned)) !== null) {
		const fullTag = match[0]
		const content = match[1] || ''

		// Parse only this script tag to check attributes with a real DOM
		const { document } = parseHTML(fullTag)
		const scriptEl = document.querySelector('script')

		if (scriptEl) {
			if (scriptEl.hasAttribute('is:build')) {
				scriptsToRemove.push({ fullTag, type: 'build', content: content.trim() })
			} else if (scriptEl.hasAttribute('is:bundled')) {
				const passData = scriptEl.getAttribute('pass:data') || undefined
				if (passData) clientPassData = passData
				scriptsToRemove.push({ fullTag, type: 'client', content: content.trim() })
			}
			// is:inline scripts are NOT extracted — they stay in the template
		}
	}

	// Remove identified scripts from the template string
	for (const s of scriptsToRemove) {
		template = template.replace(s.fullTag, '')
		if (s.type === 'build') buildContent.push(s.content)
		if (s.type === 'client') clientContent.push(s.content)
	}

	const buildScript = buildContent.length > 0 ? { content: buildContent.join('\n') } : null
	const clientScript =
		clientContent.length > 0
			? { content: clientContent.join('\n'), passDataExpr: clientPassData }
			: null

	return {
		buildScript,
		clientScript,
		template: template.trim(),
	}
}
