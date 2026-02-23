/**
 * Eager markdown-to-HTML compilation for use in collection transforms.
 *
 * @remarks
 * Uses remark + remark-html. For lazy rendering in pages, use `render()` from `aero:content` instead.
 */
import type { ContentDocument } from './types'
import { remark } from 'remark'
import remarkHtml from 'remark-html'

const processor = remark().use(remarkHtml)

/**
 * Compile a document's markdown body to HTML. Use in `transform` to attach `html` to each document.
 *
 * @param document - Content document (body is compiled).
 * @returns HTML string.
 */
export async function compileMarkdown(document: ContentDocument): Promise<string> {
	const result = await processor.process(document.body)
	return String(result)
}
