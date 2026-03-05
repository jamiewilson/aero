import type { VirtualCode, IScriptSnapshot, CodeInformation, CodeMapping } from '@volar/language-core'
import * as html from 'vscode-html-languageservice'

const htmlLs = html.getLanguageService()

const FULL_FEATURES: CodeInformation = {
	completion: true,
	format: true,
	navigation: true,
	semantic: true,
	structure: true,
	verification: true,
}

const SUPPRESSED_IN_BUILD = new Set([
	6133, // '{0}' is declared but its value is never read.
	6196, // '{0}' is declared but never used.
	6198, // All destructured elements are unused.
	7006, // Parameter '{0}' implicitly has an 'any' type.
])

const BUILD_SCRIPT_FEATURES: CodeInformation = {
	completion: true,
	format: true,
	navigation: true,
	semantic: true,
	structure: true,
	verification: {
		shouldReport: (_source, code) =>
			!SUPPRESSED_IN_BUILD.has(Number(code)),
	},
}

const ambientSnapshot: IScriptSnapshot = {
	getText: (start, end) => AMBIENT_DECLARATIONS.substring(start, end),
	getLength: () => AMBIENT_DECLARATIONS.length,
	getChangeRange: () => undefined,
}

function getScriptType(node: html.Node): 'build' | 'client' | 'inline' | 'blocking' | 'external' | null {
	if (node.tag !== 'script') return null
	const attrs = node.attributes
	if (!attrs) return 'client'

	if ('src' in attrs) return 'external'
	if ('is:build' in attrs) return 'build'
	if ('is:inline' in attrs) return 'inline'
	if ('pass:data' in attrs) return 'inline'
	if ('is:blocking' in attrs) return 'blocking'
	return 'client'
}

/** True if script has lang="ts" or lang="typescript" (required for TypeScript extraction). */
function hasLangTs(node: html.Node, sourceText: string): boolean {
	if (node.startTagEnd == null) return false
	const tagStart = sourceText.lastIndexOf('<script', node.startTagEnd)
	if (tagStart === -1) return false
	const openTag = sourceText.substring(tagStart, node.startTagEnd)
	return /\blang\s*=\s*["'](ts|typescript)["']/i.test(openTag)
}

function createSnapshot(text: string): IScriptSnapshot {
	return {
		getText: (start, end) => text.substring(start, end),
		getLength: () => text.length,
		getChangeRange: () => undefined,
	}
}

/**
 * Walks all nodes in the HTML document tree, yielding each one.
 * The vscode-html-languageservice parser only exposes `roots` and `children`,
 * so we recursively traverse to find nested script/style tags.
 */
function* walkNodes(nodes: html.Node[]): Generator<html.Node> {
	for (const node of nodes) {
		yield node
		if (node.children) {
			yield* walkNodes(node.children)
		}
	}
}

export class AeroVirtualCode implements VirtualCode {
	id = 'root'
	languageId = 'html'
	mappings: CodeMapping[]
	embeddedCodes: VirtualCode[] = []
	htmlDocument: html.HTMLDocument

	constructor(public snapshot: IScriptSnapshot) {
		this.mappings = [{
			sourceOffsets: [0],
			generatedOffsets: [0],
			lengths: [snapshot.getLength()],
			data: {
				completion: true,
				format: true,
				navigation: true,
				semantic: true,
				structure: true,
				verification: true,
			},
		}]

		const sourceText = snapshot.getText(0, snapshot.getLength())
		const doc = html.TextDocument.create('', 'html', 0, sourceText)
		this.htmlDocument = htmlLs.parseHTMLDocument(doc)
		this.embeddedCodes = [
			...this.extractEmbeddedCodes(snapshot, sourceText),
			{
				id: 'ambient',
				languageId: 'typescriptdeclaration',
				snapshot: ambientSnapshot,
				mappings: [],
				embeddedCodes: [],
			},
		]
	}

	private *extractEmbeddedCodes(
		snapshot: IScriptSnapshot,
		sourceText: string,
	): Generator<VirtualCode> {
		let buildIdx = 0
		let clientIdx = 0
		let blockingIdx = 0
		let styleIdx = 0

		for (const node of walkNodes(this.htmlDocument.roots)) {
			if (node.tag === 'style' && node.startTagEnd != null && node.endTagStart != null) {
				const styleText = sourceText.substring(node.startTagEnd, node.endTagStart)
				yield {
					id: `style_${styleIdx++}`,
					languageId: 'css',
					snapshot: createSnapshot(styleText),
					mappings: [{
						sourceOffsets: [node.startTagEnd],
						generatedOffsets: [0],
						lengths: [styleText.length],
						data: FULL_FEATURES,
					}],
					embeddedCodes: [],
				}
				continue
			}

			const scriptType = getScriptType(node)
			if (!scriptType || scriptType === 'external' || scriptType === 'inline') continue
			if (node.startTagEnd == null || node.endTagStart == null) continue

			const scriptContent = sourceText.substring(node.startTagEnd, node.endTagStart)
			if (!scriptContent.trim()) continue

			const isTs = hasLangTs(node, sourceText)

			if (scriptType === 'build') {
				if (isTs) {
					const virtualText = BUILD_SCRIPT_PREAMBLE + scriptContent
					yield {
						id: `build_${buildIdx++}`,
						languageId: 'typescript',
						snapshot: createSnapshot(virtualText),
						mappings: [{
							sourceOffsets: [node.startTagEnd],
							generatedOffsets: [BUILD_SCRIPT_PREAMBLE.length],
							lengths: [scriptContent.length],
							data: BUILD_SCRIPT_FEATURES,
						}],
						embeddedCodes: [],
					}
				} else {
					yield {
						id: `build_${buildIdx++}`,
						languageId: 'javascript',
						snapshot: createSnapshot(scriptContent),
						mappings: [{
							sourceOffsets: [node.startTagEnd],
							generatedOffsets: [0],
							lengths: [scriptContent.length],
							data: FULL_FEATURES,
						}],
						embeddedCodes: [],
					}
				}
			} else if (scriptType === 'client') {
				yield {
					id: `client_${clientIdx++}`,
					languageId: isTs ? 'typescript' : 'javascript',
					snapshot: createSnapshot(scriptContent),
					mappings: [{
						sourceOffsets: [node.startTagEnd],
						generatedOffsets: [0],
						lengths: [scriptContent.length],
						data: FULL_FEATURES,
					}],
					embeddedCodes: [],
				}
			} else if (scriptType === 'blocking') {
				yield {
					id: `blocking_${blockingIdx++}`,
					languageId: isTs ? 'typescript' : 'javascript',
					snapshot: createSnapshot(scriptContent),
					mappings: [{
						sourceOffsets: [node.startTagEnd],
						generatedOffsets: [0],
						lengths: [scriptContent.length],
						data: FULL_FEATURES,
					}],
					embeddedCodes: [],
				}
			}
		}
	}
}
