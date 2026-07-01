import * as vscode from 'vscode'
import { iterateBuildScriptBindings } from '@aero-js/compiler/build-scope-bindings'
import { maskJsComments } from '../analyzer'
import type { ParsedDocument } from '../document-analysis'
import { applyAeroDiagnosticIdentity } from '../diagnostic-metadata'

export function checkUnusedVariables(
	parsed: ParsedDocument,
	diagnostics: vscode.Diagnostic[]
): void {
	const usedInTemplate = new Set<string>()
	for (const ref of parsed.templateReferences) {
		usedInTemplate.add(ref.content)
	}

	const propsValueRegex = /(?:(?:data-aero-|aero-)?props)\s*=\s*(['"])([\s\S]*?)\1/gi
	let pdMatch: RegExpExecArray | null
	while ((pdMatch = propsValueRegex.exec(parsed.text)) !== null) {
		const value = pdMatch[2]
		const identifiers = value.match(/\b([a-zA-Z_$][\w$]*)\b/g)
		if (identifiers) {
			for (const name of identifiers) {
				usedInTemplate.add(name)
			}
		}
	}

	checkUnusedInScope(parsed, 'build', usedInTemplate, diagnostics)
	checkUnusedInScope(parsed, 'state', usedInTemplate, diagnostics)
	checkUnusedInScope(parsed, 'bundled', usedInTemplate, diagnostics)
	checkUnusedInScope(parsed, 'inline', usedInTemplate, diagnostics)
	checkUnusedInScope(parsed, 'blocking', usedInTemplate, diagnostics)
}

function isUsedInStateScript(parsed: ParsedDocument, name: string): boolean {
	const stateContent = parsed.scriptContentByScope.state
	if (!stateContent) return false
	const maskedContent = maskJsComments(stateContent).replace(/(['"])(?:(?=(\\?))\2.)*?\1/g, () =>
		' '.repeat(20)
	)
	const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const usageRegex = new RegExp(`\\b${escapedName}\\b`, 'g')
	const matches = maskedContent.match(usageRegex)
	return matches !== null && matches.length >= 1
}

function isStateScopedName(parsed: ParsedDocument, name: string): boolean {
	for (const block of parsed.scriptBlocks) {
		if (!/\bis:state\b/i.test(block.attrs)) continue
		for (const binding of iterateBuildScriptBindings(block.content, {
			includeNestedBindings: true,
		})) {
			if (binding.name === name) return true
		}
	}
	return false
}

/**
 * Count standalone references to `name` in `content`, ignoring property accesses
 * (`obj.name`) and object-literal keys (`name:`). A self-referential initializer like
 * `const links = site.footer.links` must not count its own `.links` property as a usage.
 */
function countIdentifierUsages(content: string, name: string): number {
	const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const usageRegex = new RegExp(`\\b${escapedName}\\b`, 'g')
	let count = 0
	let match: RegExpExecArray | null
	while ((match = usageRegex.exec(content)) !== null) {
		const charBefore = match.index > 0 ? content[match.index - 1] : ''
		if (charBefore === '.') continue
		count++
	}
	return count
}

function checkUnusedInScope(
	parsed: ParsedDocument,
	scope: 'build' | 'state' | 'bundled' | 'inline' | 'blocking',
	usedInTemplate: Set<string>,
	diagnostics: vscode.Diagnostic[]
): void {
	const definedVars = parsed.variablesByScope[scope]
	const scopeContent = parsed.scriptContentByScope[scope]
	const maskedContent = maskJsComments(scopeContent).replace(/(['"])(?:(?=(\\?))\2.)*?\1/g, () =>
		' '.repeat(20)
	)

	for (const [name, def] of definedVars) {
		if (scope === 'build') {
			// Consumed by the static prerender pipeline; only appears as `export async function getStaticPaths`.
			if (name === 'getStaticPaths') continue

			if (usedInTemplate.has(name)) continue

			if (isUsedInStateScript(parsed, name)) continue

			if (countIdentifierUsages(maskedContent, name) > 1) continue
		} else if (scope === 'state' || scope === 'bundled' || scope === 'blocking' || scope === 'inline') {
			if (scope === 'state' && usedInTemplate.has(name)) {
				continue
			}

			if (scope === 'bundled' && usedInTemplate.has(name) && isStateScopedName(parsed, name)) {
				continue
			}

			const usageCount = countIdentifierUsages(maskedContent, name)
			if (def.kind === 'reference') {
				if (usageCount >= 1) continue
			} else {
				if (usageCount > 1) continue
			}
		}

		const diagnostic = new vscode.Diagnostic(
			def.range,
			`'${name}' is declared but its value is never read.`,
			vscode.DiagnosticSeverity.Hint
		)
		diagnostic.tags = [vscode.DiagnosticTag.Unnecessary]
		applyAeroDiagnosticIdentity(diagnostic, 'AERO_COMPILE', 'interpolation.md')
		diagnostics.push(diagnostic)
	}
}
