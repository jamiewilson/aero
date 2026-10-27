import { resolveComponentTagSpecifier, type PathResolver } from '@aero-js/core/template-diagnostics'
import { collectImportedSpecifiersFromDocument, kebabToCamelCase } from './utils'

export function resolveComponentTagAlias(
	resolver: PathResolver,
	documentText: string,
	fromFile: string,
	classification: { baseName: string; suffix: 'component' | 'layout' },
	templateAutoImport = true
): string | undefined {
	const importName = kebabToCamelCase(classification.baseName)
	const imports = collectImportedSpecifiersFromDocument(documentText)
	const outcome = resolveComponentTagSpecifier(resolver, {
		tagBase: classification.baseName,
		kind: classification.suffix,
		importedSpecifier: imports.get(importName),
		templateAutoImport,
		fromFile,
	})
	return outcome.status === 'ok' ? outcome.specifier : undefined
}
