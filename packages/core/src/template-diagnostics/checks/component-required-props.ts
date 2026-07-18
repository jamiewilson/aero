/**
 * Required prop validation helpers for components and layouts.
 */

import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { pushOffsetDiagnostic } from '../aero-diagnostic-build'
import type { SourceDocument } from '../source-document'
import type { VariableDefinition } from '../analyzer'
import { isBuildDirectiveName } from '@aero-js/compiler/build-directive-attributes'
import { findTagNameRange } from './helpers'

/** Matches props="{ ...varName }" to extract the variable name. */
const PROPS_SPREAD_REGEX = /\{\s*\.\.\.\s*([A-Za-z_$][\w$]*)\s*\}/

/** Bare props attribute (no value) — equivalent to props="{ ...props }". */
const BARE_PROPS_ATTR_REGEX = /(?:^|\s)(?:(?:data-aero-|aero-)?props)(?!\s*=)(?:\s|\/|$)/

/**
 * Resolve the variable name spread via a props attribute, or null when not a spread.
 * Bare `props` / prefixed props (no value) maps to local variable `props`.
 */
export function resolvePropsSpreadVariable(attrs: string): string | null {
	const propsSpreadMatch = attrs.match(
		/(?:^|\s)(?:(?:data-aero-|aero-)?props)\s*=\s*["']([^"']*)["']/
	)
	if (propsSpreadMatch) {
		const value = propsSpreadMatch[1].trim()
		return value.match(PROPS_SPREAD_REGEX)?.[1] ?? null
	}
	if (BARE_PROPS_ATTR_REGEX.test(attrs)) {
		return 'props'
	}
	return null
}

export function pushPropDiagnostic(
	document: SourceDocument,
	diagnostics: AeroDiagnostic[],
	tagStart: number,
	tagName: string,
	missing: string[],
	baseName: string,
	suffix: string
): void {
	const msg =
		missing.length === 1
			? `Missing required prop '${missing[0]}' for ${baseName}-${suffix}`
			: `Missing required props: ${missing.map(m => `'${m}'`).join(', ')} for ${baseName}-${suffix}`
	const { start, end } = findTagNameRange(tagStart, tagName)
	pushOffsetDiagnostic(diagnostics, document, start, end, msg, 'AERO_COMPILE', 'error')
}

/** Extract attribute names from a tag's attribute string, excluding Aero directives. */
export function getAttributeKeysFromTag(attrs: string): string[] {
	const keys: string[] = []
	const skipAttrs = new Set(['slot', 'data-slot'])
	const attrRegex = /\b([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\s*=/gi
	let m: RegExpExecArray | null
	attrRegex.lastIndex = 0
	while ((m = attrRegex.exec(attrs)) !== null) {
		const name = m[1].toLowerCase()
		if (isBuildDirectiveName(name)) continue
		if (skipAttrs.has(name)) continue
		keys.push(name)
	}
	return keys
}

export function validateSpreadProps(
	document: SourceDocument,
	diagnostics: AeroDiagnostic[],
	tagStart: number,
	tagName: string,
	spreadVar: string,
	requiredProps: string[],
	definedVars: Map<string, VariableDefinition>,
	baseName: string,
	suffix: string
): void {
	const def = definedVars.get(spreadVar)
	const passedKeys = def?.properties ? Array.from(def.properties) : []
	const missing = requiredProps.filter(req => !passedKeys.includes(req))
	if (missing.length > 0) {
		pushPropDiagnostic(document, diagnostics, tagStart, tagName, missing, baseName, suffix)
	}
}

export function validateIndividualAttrs(
	document: SourceDocument,
	diagnostics: AeroDiagnostic[],
	tagStart: number,
	tagName: string,
	attrs: string,
	requiredProps: string[],
	baseName: string,
	suffix: string
): void {
	const attrKeys = getAttributeKeysFromTag(attrs)
	const missing = requiredProps.filter(req => !attrKeys.includes(req.toLowerCase()))
	if (missing.length > 0) {
		pushPropDiagnostic(document, diagnostics, tagStart, tagName, missing, baseName, suffix)
	}
}
