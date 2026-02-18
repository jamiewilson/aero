import type { ContentDocument } from './types'
import { remark } from 'remark'
import remarkHtml from 'remark-html'

const processor = remark().use(remarkHtml)

/**
 * Eagerly compile a document's markdown body into HTML.
 *
 * This is available as a convenience for transforms in `aero.content.ts`.
 * For lazy rendering in pages, use `render()` from `aero:content` instead.
 *
 * ```ts
 * import { compileMarkdown } from '@aero-ssg/content/markdown'
 *
 * const docs = defineCollection({
 *   // ...
 *   transform: async (doc) => ({
 *     ...doc.data,
 *     html: await compileMarkdown(doc),
 *     slug: doc._meta.slug,
 *   }),
 * })
 * ```
 */
export async function compileMarkdown(document: ContentDocument): Promise<string> {
	const result = await processor.process(document.body)
	return String(result)
}
