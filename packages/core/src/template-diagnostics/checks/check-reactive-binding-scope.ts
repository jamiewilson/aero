import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { pushOffsetDiagnostic, pushSpanDiagnostic } from '../aero-diagnostic-build'
import { rangeFromOffsets, type SourceDocument, type SourceRange } from '../source-document'
import type { ParsedDocument } from '../document-analysis'
import { hasStateScript } from './check-undefined-variables'

/** Matches `show="{ expr }"` / `html="{ expr }"` (bare or `aero-` / `data-aero-` prefixed). */
const REACTIVE_SHOW_HTML_ATTR_RE =
	/\b(?:(?:aero-|data-aero-)?(show|html))\s*=\s*(['"])\s*(\{[^'"]*\})\s*\2/gi

function stripBraces(value: string): string {
	const trimmed = value.trim()
	return trimmed.startsWith('{') && trimmed.endsWith('}')
		? trimmed.slice(1, -1).trim()
		: trimmed
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function referencesBindingExpression(
	expression: string,
	bindingNames: ReadonlySet<string>
): boolean {
	for (const name of bindingNames) {
		if (new RegExp(`\\b${escapeRegExp(name)}\\b`).test(expression)) return true
	}
	return false
}

function buildOnlyBindingNames(
	readExpr: string,
	buildNames: ReadonlySet<string>,
	stateNames: ReadonlySet<string>
): string[] {
	const names: string[] = []
	for (const name of buildNames) {
		if (stateNames.has(name)) continue
		if (new RegExp(`\\b${escapeRegExp(name)}\\b`).test(readExpr)) names.push(name)
	}
	return names
}

function rangeForIdentifierInBracedValue(
	document: SourceDocument,
	text: string,
	bracedStart: number,
	braced: string,
	name: string
): SourceRange | null {
	const slice = text.slice(bracedStart, bracedStart + braced.length)
	const match = new RegExp(`\\b${escapeRegExp(name)}\\b`).exec(slice)
	if (!match || match.index === undefined) return null
	const start = bracedStart + match.index
	return rangeFromOffsets(document, start, start + name.length)
}

function reactiveBindingScopeMessage(attrName: string): string {
	return `Reactive \`${attrName}\` binding must reference a declared state variable.`
}

export function checkReactiveBindingScope(
	document: SourceDocument,
	parsed: ParsedDocument,
	diagnostics: AeroDiagnostic[]
): void {
	if (!hasStateScript(parsed)) return

	const stateNames = new Set(parsed.variablesByScope.state.keys())
	const buildNames = new Set(parsed.variablesByScope.build.keys())
	if (buildNames.size === 0) return

	const text = parsed.text
	for (const match of text.matchAll(REACTIVE_SHOW_HTML_ATTR_RE)) {
		const attrName = match[1]?.toLowerCase()
		const braced = match[3]
		if (!attrName || !braced) continue

		const readExpr = stripBraces(braced)
		if (!readExpr) continue
		if (referencesBindingExpression(readExpr, stateNames)) continue

		const offendingNames = buildOnlyBindingNames(readExpr, buildNames, stateNames)
		if (offendingNames.length === 0) continue

		const matchStart = match.index ?? 0
		const bracedStart = matchStart + match[0].indexOf(braced)

		for (const name of offendingNames) {
			const range = rangeForIdentifierInBracedValue(document, text, bracedStart, braced, name)
			if (!range) continue
			pushSpanDiagnostic(diagnostics, document, range, reactiveBindingScopeMessage(attrName), 'AERO_COMPILE', 'error')
		}
	}
}
