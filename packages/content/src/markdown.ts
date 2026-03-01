/**
 * Eager markdown-to-HTML compilation for use in collection transforms.
 *
 * @remarks
 * Delegates to the shared processor from `./processor`. For lazy rendering in pages,
 * use `render()` from `aero:content` instead.
 */
import type { ContentDocument } from './types'
import { getProcessor } from './processor'

/**
 * Compile a document's markdown body to HTML. Use in `transform` to attach `html` to each document.
 *
 * @param document - Content document (body is compiled).
 * @returns HTML string.
 */
export async function compileMarkdown(document: ContentDocument): Promise<string> {
	const result = await getProcessor().process(document.body)
	return String(result)
}
