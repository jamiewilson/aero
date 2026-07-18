/**
 * Shared brace-shape validation for runtime binding directives (`show`, `html`, `busy`, `class:*`).
 *
 * Used by the compiler lowerer and IDE `checkDirectiveExpressionBraces` so compile ↔ IDE stay aligned.
 */

import { looksBracedDirectiveValue } from './build-directive-attributes'
import { normalizeRuntimeDirectiveName } from './runtime-directive-attributes'

export interface RuntimeDirectiveBraceInput {
	readonly attrName: string
	readonly rawValue: string | null | undefined
	/**
	 * True when the attribute has an `=` value in source (including empty `=""`).
	 * False for bare boolean form (`class:is-active` with no `=`).
	 */
	readonly hasValue: boolean
}

const ALWAYS_BRACED_BINDINGS = new Set(['show', 'html', 'busy'])

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Whether `attrName` appears with an explicit `=` in `sourceSlice` (opening tag or file slice).
 */
export function attributeHasExplicitValueInSource(
	sourceSlice: string | undefined,
	attrName: string
): boolean {
	if (!sourceSlice) return false
	return new RegExp(`(?:^|\\s)${escapeRegExp(attrName)}\\s*=`).test(sourceSlice)
}

/**
 * Resolve hasValue for a DOM/parser attribute: non-empty value, or empty/`""` with `=` in source.
 */
export function resolveRuntimeDirectiveHasValue(
	attrName: string,
	attrValue: string | null | undefined,
	sourceSlice?: string
): boolean {
	if (attrValue != null && String(attrValue).length > 0) return true
	return attributeHasExplicitValueInSource(sourceSlice, attrName)
}

function isRuntimeClassBinding(canonicalBareName: string): boolean {
	return canonicalBareName.startsWith('class-') && canonicalBareName.length > 6
}

/**
 * Whether this runtime binding requires a braced expression given `hasValue`.
 *
 * - `show` / `html` / `busy` — always (when present)
 * - `class:*` — only when the attribute has an explicit value (`=`), not bare shorthand
 */
export function runtimeDirectiveRequiresBracedValue(
	attrName: string,
	hasValue: boolean
): boolean {
	const normalized = normalizeRuntimeDirectiveName(attrName)
	if (!normalized || normalized.family !== 'binding') return false
	const bare = normalized.canonicalBareName
	if (ALWAYS_BRACED_BINDINGS.has(bare)) return true
	if (isRuntimeClassBinding(bare)) return hasValue
	return false
}

/**
 * Source-level brace issue for runtime bindings, or `null` when OK / not applicable.
 *
 * Message shape matches IDE event braces (`Directive \`name\` must use a braced expression…`)
 * so parity can use a shared `messageIncludes`.
 */
export function getRuntimeDirectiveBraceIssue(
	input: RuntimeDirectiveBraceInput
): string | null {
	if (!runtimeDirectiveRequiresBracedValue(input.attrName, input.hasValue)) return null
	if (looksBracedDirectiveValue(input.rawValue)) return null
	const example = `${input.attrName}="{ expression }"`
	return `Directive \`${input.attrName}\` must use a braced expression, e.g. ${example}`
}
