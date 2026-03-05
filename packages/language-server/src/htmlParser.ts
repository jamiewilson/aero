/**
 * Minimal HTML parser wrapper that uses only the parser from vscode-html-languageservice,
 * avoiding the ~600KB webCustomData.js. We need parseHTMLDocument and the HTMLDocument
 * shape (roots, findNodeBefore, findNodeAt) for virtual code extraction.
 */
import { HTMLParser } from 'vscode-html-languageservice/lib/esm/parser/htmlParser.js'
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
 * Parses an HTML document into the structure expected by Aero virtual code.
 * Uses only the parser (no completion/hover/validation data).
 */
export function parseHTMLDocument(document: TextDocument): HTMLDocument {
	return parser.parseDocument(document) as HTMLDocument
}

export type { HTMLDocument, Node }
