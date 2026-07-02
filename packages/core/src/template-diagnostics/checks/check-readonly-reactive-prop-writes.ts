import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { pushOffsetDiagnostic, pushSpanDiagnostic } from '../aero-diagnostic-build'
import { rangeFromOffsets, type SourceDocument, type SourceRange } from '../source-document'
import {
	analyzeStateScript,
	collectReadonlyReactivePropWritesInExpression,
	collectTemplateInterpolationSites,
	readonlyReactivePropWriteMessage,
} from '@aero-js/compiler'
import type { ParsedDocument } from '../document-analysis'

export function checkReadonlyReactivePropWrites(
	document: SourceDocument,
	parsed: ParsedDocument,
	diagnostics: AeroDiagnostic[]
): void {
	const stateBlocks = parsed.scriptBlocks.filter(block => block.kind === 'state')
	if (stateBlocks.length === 0) return

	const readonlyReactivePropNames = new Set<string>()
	const reactivePropNameToPropName = new Map<string, string>()
	for (const block of stateBlocks) {
		try {
			const analysis = analyzeStateScript(block.content)
			for (const binding of analysis.bindings) {
				if (!binding.reactiveProp || binding.bindable) continue
				readonlyReactivePropNames.add(binding.name)
				reactivePropNameToPropName.set(binding.name, binding.propName ?? binding.name)
			}
			for (const diagnostic of analysis.diagnostics) {
				if (!diagnostic.message.includes('is readonly')) continue
				const range = diagnostic.range ?? [0, block.content.length]
				pushReadonlyReactivePropDiagnostic(
					document,
					diagnostics,
					block.contentStart + range[0],
					block.contentStart + range[1],
					reactivePropNameToPropName.get(diagnostic.name) ?? diagnostic.name
				)
			}
		} catch {
			// Keep live editor diagnostics resilient while the user is typing incomplete state scripts.
		}
	}

	if (readonlyReactivePropNames.size === 0) return
	for (const site of collectTemplateInterpolationSites(parsed.text)) {
		if (!site.isEventHandler) continue
		for (const write of collectReadonlyReactivePropWritesInExpression(
			site.expression,
			readonlyReactivePropNames
		)) {
			const range = write.range ?? [0, site.expression.length]
			pushReadonlyReactivePropDiagnostic(
				document,
				diagnostics,
				site.braceOffset + range[0],
				site.braceOffset + range[1],
				reactivePropNameToPropName.get(write.name) ?? write.name
			)
		}
	}
}

function pushReadonlyReactivePropDiagnostic(
	document: SourceDocument,
	diagnostics: AeroDiagnostic[],
	startOffset: number,
	endOffset: number,
	name: string
): void {
	pushOffsetDiagnostic(
		diagnostics,
		document,
		startOffset,
		endOffset,
		readonlyReactivePropWriteMessage(name),
		'AERO_COMPILE',
		'error'
	)
}
