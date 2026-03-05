import type { LanguagePlugin, VirtualCode, IScriptSnapshot } from '@volar/language-core'
import { forEachEmbeddedCode } from '@volar/language-core'
import type { TypeScriptExtraServiceScript } from '@volar/typescript'
import type * as ts from 'typescript'
import type { URI } from 'vscode-uri'
import { AeroVirtualCode } from './virtualCode'

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

	createVirtualCode(_uri, languageId, snapshot) {
		if (languageId === 'aero') {
			return new AeroVirtualCode(snapshot)
		}
	},

	updateVirtualCode(_uri, _virtualCode, snapshot) {
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
