import * as vscode from 'vscode'
import {
	analyzeStateScript,
	collectReadonlyLivePropWritesInExpression,
	collectTemplateInterpolationSites,
	readonlyLivePropWriteMessage,
} from '@aero-js/compiler'
import type { ParsedDocument } from '../document-analysis'
import { applyAeroDiagnosticIdentity } from '../diagnostic-metadata'

export function checkReadonlyLivePropWrites(
	document: vscode.TextDocument,
	parsed: ParsedDocument,
	diagnostics: vscode.Diagnostic[]
): void {
	const stateBlocks = parsed.scriptBlocks.filter(block => block.kind === 'state')
	if (stateBlocks.length === 0) return

	const readonlyLivePropNames = new Set<string>()
	const livePropNameToPropName = new Map<string, string>()
	for (const block of stateBlocks) {
		try {
			const analysis = analyzeStateScript(block.content)
			for (const binding of analysis.bindings) {
				if (!binding.liveProp || binding.bindable) continue
				readonlyLivePropNames.add(binding.name)
				livePropNameToPropName.set(binding.name, binding.propName ?? binding.name)
			}
			for (const diagnostic of analysis.diagnostics) {
				if (!diagnostic.message.includes('is readonly')) continue
				const range = diagnostic.range ?? [0, block.content.length]
				pushReadonlyLivePropDiagnostic(
					document,
					diagnostics,
					block.contentStart + range[0],
					block.contentStart + range[1],
					livePropNameToPropName.get(diagnostic.name) ?? diagnostic.name
				)
			}
		} catch {
			// Keep live editor diagnostics resilient while the user is typing incomplete state scripts.
		}
	}

	if (readonlyLivePropNames.size === 0) return
	for (const site of collectTemplateInterpolationSites(parsed.text)) {
		if (!site.isEventHandler) continue
		for (const write of collectReadonlyLivePropWritesInExpression(
			site.expression,
			readonlyLivePropNames
		)) {
			const range = write.range ?? [0, site.expression.length]
			pushReadonlyLivePropDiagnostic(
				document,
				diagnostics,
				site.braceOffset + range[0],
				site.braceOffset + range[1],
				livePropNameToPropName.get(write.name) ?? write.name
			)
		}
	}
}

function pushReadonlyLivePropDiagnostic(
	document: vscode.TextDocument,
	diagnostics: vscode.Diagnostic[],
	startOffset: number,
	endOffset: number,
	name: string
): void {
	const diagnostic = new vscode.Diagnostic(
		new vscode.Range(document.positionAt(startOffset), document.positionAt(endOffset)),
		readonlyLivePropWriteMessage(name),
		vscode.DiagnosticSeverity.Error
	)
	applyAeroDiagnosticIdentity(diagnostic, 'AERO_COMPILE', 'reactivity.md')
	diagnostics.push(diagnostic)
}
