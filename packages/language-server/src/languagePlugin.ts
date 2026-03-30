import type { LanguagePlugin, VirtualCode, IScriptSnapshot } from '@volar/language-core'
import { forEachEmbeddedCode } from '@volar/language-core'
import type { TypeScriptExtraServiceScript } from '@volar/typescript'
import type * as ts from 'typescript'
import type { URI } from 'vscode-uri'
import { AeroVirtualCode } from './virtualCode'

/**
 * VS Code's first language-id resolver returns the TextDocument's languageId. Files are often
 * still `html` until the extension runs setTextDocumentLanguage → `aero`, so we must accept both.
 */
function isHtmlTemplateUri(uri: URI): boolean {
	return uri.path.toLowerCase().endsWith('.html')
}

function shouldCreateAeroVirtualCode(uri: URI, languageId: string): boolean {
	if (!isHtmlTemplateUri(uri)) return false
	return languageId === 'aero' || languageId === 'html'
}

const MODULE_SCRIPT_CONTENT = "export default '';\n"
const moduleSnapshot: IScriptSnapshot = {
	getText: (start, end) => MODULE_SCRIPT_CONTENT.substring(start, end),
	getLength: () => MODULE_SCRIPT_CONTENT.length,
	getChangeRange: () => undefined,
}
const moduleVirtualCode: VirtualCode = {
	id: 'module',
	languageId: 'typescript',
	snapshot: moduleSnapshot,
	mappings: [],
	embeddedCodes: [],
}

export const aeroLanguagePlugin: LanguagePlugin<URI> = {
	getLanguageId(uri) {
		if (uri.path.endsWith('.html')) {
			return 'aero'
		}
	},

	createVirtualCode(uri, languageId, snapshot) {
		if (shouldCreateAeroVirtualCode(uri, languageId)) {
			return new AeroVirtualCode(snapshot)
		}
	},

	updateVirtualCode(uri, _virtualCode, snapshot) {
		if (!isHtmlTemplateUri(uri)) return undefined
		return new AeroVirtualCode(snapshot)
	},

	typescript: {
		extraFileExtensions: [
			{ extension: 'html', isMixedContent: true, scriptKind: 7 satisfies ts.ScriptKind.Deferred },
		],
		resolveHiddenExtensions: true,

		getServiceScript() {
			return {
				code: moduleVirtualCode,
				extension: '.ts',
				scriptKind: 3 satisfies ts.ScriptKind.TS,
			}
		},

		getExtraServiceScripts(fileName, root) {
			const scripts: TypeScriptExtraServiceScript[] = []
			for (const code of forEachEmbeddedCode(root)) {
				if (code.languageId === 'typescript') {
					scripts.push({
						fileName: fileName + '.' + code.id + '.ts',
						code,
						extension: '.ts',
						scriptKind: 3 satisfies ts.ScriptKind.TS,
					})
				} else if (code.languageId === 'javascript') {
					scripts.push({
						fileName: fileName + '.' + code.id + '.js',
						code,
						extension: '.js',
						scriptKind: 1 satisfies ts.ScriptKind.JS,
					})
				} else if (code.languageId === 'typescriptdeclaration') {
					scripts.push({
						fileName: fileName + '.' + code.id + '.d.ts',
						code,
						extension: '.d.ts',
						scriptKind: 3 satisfies ts.ScriptKind.TS,
					})
				}
			}
			return scripts
		},
	},
}
