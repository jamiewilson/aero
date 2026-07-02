import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { pushOffsetDiagnostic, pushSpanDiagnostic } from '../aero-diagnostic-build'
import { rangeFromOffsets, type SourceDocument, type SourceRange } from '../source-document'
/**
 * Diagnostic check: undefined variables in client script bodies unless injected via
 * that block's `props` attribute or declared locally.
 */
import { parsePropsAttributeBindings, type BuildBindingProperties } from '@aero-js/compiler'
import { iterateBuildScriptBindings } from '@aero-js/compiler/build-scope-bindings'
import type { ParsedDocument } from '../document-analysis'
import type { VariableDefinition } from '../analyzer'
import { collectIdentifierReferences } from '../analyzer/references'
import { isInsideHtmlComment } from '../analyzer/helpers'
import { parseScriptBlocks } from '../script-tag'

const CLIENT_SCRIPT_SCOPES = new Set(['bundled', 'inline', 'blocking'])

/** Globals available in browser script contexts without props injection. */
const SCRIPT_ALLOWED_GLOBALS: ReadonlySet<string> = new Set([
	'console',
	'Math',
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
	'localStorage',
	'sessionStorage',
	'fetch',
	'location',
	'navigator',
	'history',
	'crypto',
	'requestAnimationFrame',
	'cancelAnimationFrame',
	'setTimeout',
	'clearTimeout',
	'setInterval',
	'clearInterval',
	'URL',
	'URLSearchParams',
	'FormData',
	'Headers',
	'Request',
	'Response',
	'Event',
	'CustomEvent',
	'HTMLElement',
	'Element',
	'Node',
	'MutationObserver',
	'IntersectionObserver',
	'ResizeObserver',
])

const PROPS_VALUE_IN_ATTRS = /(?:(?:data-aero-|aero-)?props)\s*=\s*(['"])([\s\S]*?)\1/i

function toBuildBindingProperties(
	definedVariables: Map<string, VariableDefinition>
): BuildBindingProperties {
	const out = new Map<string, ReadonlySet<string>>()
	for (const [name, def] of definedVariables) {
		if (def.properties && def.properties.size > 0) {
			out.set(name, def.properties)
		}
	}
	return out
}

function collectDefinedNamesInScriptBlock(
	blockContent: string,
	propsInjected: readonly string[]
): Set<string> {
	const names = new Set<string>(propsInjected)
	for (const binding of iterateBuildScriptBindings(blockContent, { includeNestedBindings: true })) {
		names.add(binding.name)
	}
	return names
}

function pushUndefinedDiagnostic(
	diagnostics: AeroDiagnostic[],
	document: SourceDocument,
	range: SourceRange,
	name: string
): void {
	pushSpanDiagnostic(diagnostics, document, range, `Variable '${name}' is not defined`, 'AERO_COMPILE', 'error')
}

function checkPropsExpressionRefs(
	document: SourceDocument,
	blockAttrs: string,
	tagStart: number,
	expressionRefs: readonly string[],
	buildScopeNames: ReadonlySet<string>,
	diagnostics: AeroDiagnostic[]
): void {
	if (expressionRefs.length === 0) return

	const match = blockAttrs.match(PROPS_VALUE_IN_ATTRS)
	if (!match) return

	const quote = match[1]
	const value = match[2]
	const valueStartInAttrs = match.index! + match[0].indexOf(quote + value + quote) + 1
	const attrsStart = tagStart + '<script'.length
	const valueStart = attrsStart + valueStartInAttrs

	const valueRefs = collectIdentifierReferences(document, value, valueStart, true)
	const reported = new Set<string>()

	for (const ref of valueRefs) {
		if (buildScopeNames.has(ref.content)) continue
		if (SCRIPT_ALLOWED_GLOBALS.has(ref.content)) continue
		if (reported.has(ref.content)) continue
		reported.add(ref.content)
		if (!expressionRefs.includes(ref.content)) continue
		pushUndefinedDiagnostic(diagnostics, document, ref.range, ref.content)
	}
}

export function checkUndefinedScriptVariables(
	document: SourceDocument,
	parsed: ParsedDocument,
	diagnostics: AeroDiagnostic[]
): void {
	const { text, definedVariables } = parsed
	const buildBindingProperties = toBuildBindingProperties(definedVariables)
	const buildScopeNames = new Set(definedVariables.keys())

	for (const block of parseScriptBlocks(text)) {
		if (!CLIENT_SCRIPT_SCOPES.has(block.kind)) continue
		if (isInsideHtmlComment(text, block.tagStart)) continue
		if (!block.content.trim()) continue

		const parsedProps = parsePropsAttributeBindings(block.attrs, buildBindingProperties)
		const definedInBlock = collectDefinedNamesInScriptBlock(
			block.content,
			parsedProps.injectedNames
		)

		checkPropsExpressionRefs(
			document,
			block.attrs,
			block.tagStart,
			parsedProps.expressionRefs,
			buildScopeNames,
			diagnostics
		)

		const refs = collectIdentifierReferences(document, block.content, block.contentStart)
		const reported = new Set<string>()

		for (const ref of refs) {
			if (SCRIPT_ALLOWED_GLOBALS.has(ref.content)) continue
			if (definedInBlock.has(ref.content)) continue
			if (buildScopeNames.has(ref.content)) {
				// Build-scope names are not in scope inside client scripts without props injection.
				if (reported.has(ref.content)) continue
				reported.add(ref.content)
				pushUndefinedDiagnostic(diagnostics, document, ref.range, ref.content)
				continue
			}
			if (reported.has(ref.content)) continue
			reported.add(ref.content)
			pushUndefinedDiagnostic(diagnostics, document, ref.range, ref.content)
		}
	}
}
