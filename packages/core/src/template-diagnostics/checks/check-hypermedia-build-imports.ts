import type { AeroDiagnostic } from '@aero-js/diagnostics'
import {
	HYPERMEDIA_BUILD_IMPORT_MESSAGE,
	HYPERMEDIA_STATE_IMPORT_MESSAGE,
	collectHypermediaActionImportsInBuildScript,
	collectMissingHypermediaActionImportsInStateScript,
} from '@aero-js/compiler/hypermedia-build-imports'
import { pushOffsetDiagnostic } from '../aero-diagnostic-build'
import { parseScriptBlocks } from '../script-tag'
import type { SourceDocument } from '../source-document'

/**
 * Diagnostic check: hypermedia action verbs — ban in `is:build`, require import in `is:state`.
 */
export function checkHypermediaBuildImports(
	document: SourceDocument,
	text: string,
	diagnostics: AeroDiagnostic[]
): void {
	for (const block of parseScriptBlocks(text)) {
		if (block.kind === 'build') {
			if (!block.content.trim()) continue
			for (const hit of collectHypermediaActionImportsInBuildScript(block.content)) {
				pushOffsetDiagnostic(
					diagnostics,
					document,
					block.contentStart + hit.start,
					block.contentStart + hit.end,
					HYPERMEDIA_BUILD_IMPORT_MESSAGE,
					'AERO_COMPILE',
					'error'
				)
			}
			continue
		}
		if (block.kind !== 'state') continue
		if (!block.content.trim()) continue
		for (const hit of collectMissingHypermediaActionImportsInStateScript(block.content)) {
			pushOffsetDiagnostic(
				diagnostics,
				document,
				block.contentStart + hit.start,
				block.contentStart + hit.end,
				HYPERMEDIA_STATE_IMPORT_MESSAGE,
				'AERO_COMPILE',
				'error'
			)
		}
	}
}
