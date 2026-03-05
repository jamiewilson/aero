declare module 'vscode-html-languageservice/lib/esm/parser/htmlParser.js' {
	import type { HTMLDocument } from 'vscode-html-languageservice'
	import type { TextDocument } from 'vscode-languageserver-textdocument'

	export class HTMLParser {
		constructor(dataManager: unknown)
		parseDocument(document: TextDocument): HTMLDocument
	}
}
