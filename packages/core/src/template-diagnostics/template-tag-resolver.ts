import {
	formatResolveTemplateTagError,
	resolveTemplateTag,
	type TemplateTagKind,
} from '@aero-js/compiler'
import type { PathResolver } from './path-resolver'
import { getTemplateTagIndex } from './path-resolver'
import { isValidTemplateImportSpecifier } from './importResolution'

export type ComponentTagResolveResult =
	| { readonly status: 'ok'; readonly specifier: string }
	| { readonly status: 'not-imported' }
	| {
			readonly status: 'diagnostic'
			readonly message: string
			readonly severity: 'error' | 'warning'
	  }

/**
 * Resolve a component/layout tag to an import specifier for diagnostics and IDE tooling.
 *
 * @remarks
 * Explicit build-script imports win when present and use a valid template specifier.
 */
export function resolveComponentTagSpecifier(
	resolver: PathResolver,
	options: {
		tagBase: string
		kind: TemplateTagKind
		importedSpecifier: string | undefined
		templateAutoImport: boolean
		fromFile: string
	}
): ComponentTagResolveResult {
	const { tagBase, kind, importedSpecifier, templateAutoImport, fromFile } = options

	if (importedSpecifier && isValidTemplateImportSpecifier(importedSpecifier)) {
		const resolved = resolver.resolve(importedSpecifier, fromFile)
		if (!resolved) {
			const kindLabel = kind === 'component' ? 'Component' : 'Layout'
			return {
				status: 'diagnostic',
				message: `${kindLabel} file not found: ${tagBase}.html`,
				severity: 'warning',
			}
		}
		return { status: 'ok', specifier: importedSpecifier }
	}

	if (!templateAutoImport) {
		return { status: 'not-imported' }
	}

	const index = getTemplateTagIndex(resolver)
	const resolved = resolveTemplateTag(index, kind, tagBase)
	if (resolved.status !== 'ok') {
		return {
			status: 'diagnostic',
			message: formatResolveTemplateTagError(resolved),
			severity: 'error',
		}
	}

	return { status: 'ok', specifier: resolved.entry.specifier }
}
