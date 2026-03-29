/**
 * Minimal HTML parse + tree walk using only the parser from `vscode-html-languageservice`
 * (no ~600KB web custom data). Shared by the Aero language server and VS Code extension.
 */
import { HTMLParser } from 'vscode-html-languageservice/lib/umd/parser/htmlParser.js'
import type { HTMLDocument, Node } from 'vscode-html-languageservice'
import { TextDocument } from 'vscode-languageserver-textdocument'

/** HTML5 void elements (sorted for binary search compatibility). */
const VOID_ELEMENTS = [
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr',
]

const minimalDataManager = {
	getVoidElements: (_languageId?: string) => VOID_ELEMENTS,
	isVoidElement: (tag: string | undefined, voidElements: readonly string[]) =>
		!!tag && voidElements.indexOf(tag.toLowerCase()) >= 0,
}

const parser = new HTMLParser(minimalDataManager as never)

/**
 * Parses document text into an `HTMLDocument` (roots, node offsets; no completion data).
 */
export function parseMinimalHtmlDocument(document: TextDocument): HTMLDocument {
	return parser.parseDocument(document) as HTMLDocument
}

/** Convenience: create a transient `TextDocument` and parse it. */
export function parseMinimalHtmlFromText(text: string, uri = ''): HTMLDocument {
	return parseMinimalHtmlDocument(TextDocument.create(uri, 'html', 0, text))
}

/** @remarks Alias for {@link parseMinimalHtmlFromText} — Aero templates use this name in the extension. */
export const parseAeroHtmlDocument = parseMinimalHtmlFromText

/**
 * Depth-first traversal of the vscode-html-languageservice node tree.
 */
export function* walkHtmlNodes(nodes: Node[]): Generator<Node> {
	for (const node of nodes) {
		yield node
		if (node.children) {
			yield* walkHtmlNodes(node.children)
		}
	}
}

export type { HTMLDocument, Node }
