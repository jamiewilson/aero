import type { ContentDocument } from './types'
import { remark } from 'remark'
import remarkHtml from 'remark-html'

const processor = remark().use(remarkHtml)

/**
 * Lazily render a content document's markdown body to HTML.
 *
 * Usage in pages:
 * ```html
 * <script on:build>
 *   import { getCollection, render } from 'aero:content'
 *   const doc = Aero.props
 *   const { html } = await render(doc)
 * </script>
 * <section>{html}</section>
 * ```
 */
export async function render(doc: ContentDocument): Promise<{ html: string }> {
	const result = await processor.process(doc.body)
	return { html: String(result) }
}
