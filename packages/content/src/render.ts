/**
 * Lazy markdown-to-HTML for use in pages (import from `aero:content`).
 *
 * @remarks
 * Uses the same remark pipeline as compileMarkdown. Call from on:build with a document (e.g. from getCollection); returns `{ html }`.
 */
import type { ContentDocument } from './types'
import { remark } from 'remark'
import remarkHtml from 'remark-html'

const processor = remark().use(remarkHtml)

/**
 * Render a content document's markdown body to HTML. Use in pages with documents from getCollection.
 *
 * @param doc - Content document (or null/undefined; returns empty HTML and logs a warning).
 * @returns `{ html: string }`.
 */
export async function render(
	doc: ContentDocument | null | undefined,
): Promise<{ html: string }> {
	if (!doc) {
		console.warn('[aero] render() received null or undefined document. Returning empty HTML.')
		return { html: '' }
	}
	const result = await processor.process(doc.body)
	return { html: String(result) }
}
