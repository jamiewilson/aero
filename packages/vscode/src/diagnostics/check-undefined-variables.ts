import * as vscode from 'vscode'
import { iterateBuildScriptBindings } from '@aero-js/compiler/build-scope-bindings'
import type { ParsedDocument } from '../document-analysis'
import { applyAeroDiagnosticIdentity } from '../diagnostic-metadata'
import { findInnermostScope } from '../utils'
import type { TemplateScope } from '../analyzer'

function collectStateBindingNames(parsed: ParsedDocument): Set<string> {
	const names = new Set<string>()
	for (const block of parsed.scriptBlocks) {
		if (!/\bis:state\b/i.test(block.attrs)) continue
		for (const binding of iterateBuildScriptBindings(block.content, {
			includeNestedBindings: true,
		})) {
			names.add(binding.name)
		}
	}
	return names
}

export function hasStateScript(parsed: ParsedDocument): boolean {
	return parsed.scriptBlocks.some(block => /\bis:state\b/i.test(block.attrs))
}

export function hasBuildScript(parsed: ParsedDocument): boolean {
	return parsed.scriptBlocks.some(block => block.kind === 'build')
}

/** Allowed globals that are always available in templates. */
const ALLOWED_GLOBALS: ReadonlySet<string> = new Set([
	'Aero',
	// Shorthand: { url }, { request }, { params } compile to Aero.page.*
	'url',
	'request',
	'params',
	'console',
	'Math',
	'raw',
	'JSON',
	'Object',
	'Array',
	'String',
	'Number',
	'Boolean',
	'Date',
	'RegExp',
	'Map',
	'Set',
	'WeakMap',
	'WeakSet',
	'Promise',
	'Error',
	'NaN',
	'Infinity',
	'undefined',
	'null',
	'true',
	'false',
	'window',
	'document',
	'globalThis',
	// Alpine.js built-ins
	'$el',
	'$event',
	'$data',
	'$dispatch',
	'$refs',
	'$watch',
	'$root',
	'$nextTick',
	'$tick',
	'$store',
	'$persist',
	'$restore',
	'$abi',
	// HTMX built-ins
	'$target',
	'$trigger',
	'$triggerElement',
	'$response',
	// `on:*` handler parameter (matches runtime mount + virtual TS prelude)
	'event',
	// Hypermedia action functions (matches runtime mount action scope + virtual TS prelude)
	'GET',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
])

function isBoundByForScope(scope: TemplateScope, id: string): boolean {
	if (scope.bindingNames.includes(id)) return true
	if (id === 'index' || id === 'first' || id === 'last' || id === 'length') return true
	return false
}

export function checkUndefinedVariables(
	parsed: ParsedDocument,
	diagnostics: vscode.Diagnostic[]
): void {
	const definedVars = parsed.definedVariables
	const stateBindings = collectStateBindingNames(parsed)
	const templateScopes = parsed.templateScopes
	const references = parsed.templateReferences
	const buildContentGlobalRefs = parsed.buildContentGlobalReferences

	for (const ref of references) {
		if (ALLOWED_GLOBALS.has(ref.content)) continue
		if (ref.isAlpine) continue

		const def = definedVars.get(ref.content)
		if (def) {
			if (def.properties && ref.propertyPath && ref.propertyPath.length > 0) {
				const firstProp = ref.propertyPath[0]
				if (!def.properties.has(firstProp)) {
					const range =
						ref.propertyRanges && ref.propertyRanges.length > 0 ? ref.propertyRanges[0] : ref.range
					const diagnostic = new vscode.Diagnostic(
						range,
						`Property '${firstProp}' does not exist on type '${ref.content}'`,
						vscode.DiagnosticSeverity.Error
					)
					applyAeroDiagnosticIdentity(diagnostic, 'AERO_COMPILE', 'props.md')
					diagnostics.push(diagnostic)
				}
			}
			continue
		}

		if (stateBindings.has(ref.content)) continue

		const scope = findInnermostScope(templateScopes, ref.offset)
		if (scope && isBoundByForScope(scope, ref.content)) continue

		let parentScope = scope
		let foundInScope = false
		while (parentScope) {
			if (isBoundByForScope(parentScope, ref.content)) {
				foundInScope = true
				break
			}
			parentScope = findParentScope(templateScopes, parentScope)
		}
		if (foundInScope) continue

		const message = ref.isComponent
			? `Component '${ref.content}' is not defined`
			: `Variable '${ref.content}' is not defined`

		const diagnostic = new vscode.Diagnostic(ref.range, message, vscode.DiagnosticSeverity.Error)
		applyAeroDiagnosticIdentity(diagnostic, 'AERO_COMPILE', 'interpolation.md')
		diagnostics.push(diagnostic)
	}

	for (const ref of buildContentGlobalRefs) {
		if (definedVars.has(ref.content) || stateBindings.has(ref.content)) continue

		const diagnostic = new vscode.Diagnostic(
			ref.range,
			`Variable '${ref.content}' is not defined`,
			vscode.DiagnosticSeverity.Error
		)
		applyAeroDiagnosticIdentity(diagnostic, 'AERO_COMPILE', 'interpolation.md')
		diagnostics.push(diagnostic)
	}
}

function findParentScope(scopes: TemplateScope[], child: TemplateScope): TemplateScope | null {
	let best: TemplateScope | null = null
	for (const scope of scopes) {
		if (scope === child) continue
		if (child.startOffset >= scope.startOffset && child.endOffset <= scope.endOffset) {
			if (!best) {
				best = scope
				continue
			}
			const bestSize = best.endOffset - best.startOffset
			const thisSize = scope.endOffset - scope.startOffset
			if (thisSize <= bestSize) {
				best = scope
			}
		}
	}
	return best
}
