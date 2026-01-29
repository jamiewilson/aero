import { parseHTML } from 'linkedom'
import type { ParseResult } from '@src/types'

/**
 * Parses the input HTML and extracts TBD-specific scripts.
 *
 * We use a hybrid approach: regex to find script tags and linkedom to validate
 * their attributes. This is 100% non-destructive and preserves the
 * original template structure (including doctypes and head/body tags) exactly.
 */
export function parse(html: string): ParseResult {
	let template = html
	let buildContent: string[] = []
	let clientContent: string[] = []

	// Match <script ...>...</script>
	const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi

	const scriptsToRemove: { fullTag: string; type: 'build' | 'client'; content: string }[] = []

	let match
	while ((match = scriptRegex.exec(html)) !== null) {
		const fullTag = match[0]
		const content = match[1] || ''

		// Parse only this script tag to check attributes with a real DOM
		const { document } = parseHTML(fullTag)
		const scriptEl = document.querySelector('script')

		if (scriptEl) {
			if (scriptEl.hasAttribute('on:build')) {
				scriptsToRemove.push({ fullTag, type: 'build', content: content.trim() })
			} else if (scriptEl.hasAttribute('on:client')) {
				scriptsToRemove.push({ fullTag, type: 'client', content: content.trim() })
			}
		}
	}

	// Remove identified scripts from the template string
	for (const s of scriptsToRemove) {
		template = template.replace(s.fullTag, '')
		if (s.type === 'build') buildContent.push(s.content)
		if (s.type === 'client') clientContent.push(s.content)
	}

	const buildScript = buildContent.length > 0 ? { content: buildContent.join('\n') } : null
	const clientScript = clientContent.length > 0 ? { content: clientContent.join('\n') } : null

	return {
		buildScript,
		clientScript,
		template: template.trim(),
	}
}
