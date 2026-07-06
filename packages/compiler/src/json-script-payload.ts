/**
 * Shared contract for non-executable JSON payloads embedded in `<script>` tags.
 */

export const AERO_JSON_SCRIPT_TYPE = 'application/json'
export const AERO_JSON_ROLE_PROPS = 'props'
export const AERO_JSON_ROLE_STATE = 'state'

export type AeroJsonScriptRole =
	| typeof AERO_JSON_ROLE_PROPS
	| typeof AERO_JSON_ROLE_STATE

/** CSS selector for a role-specific Aero JSON script payload. */
export function aeroJsonScriptRoleSelector(role: AeroJsonScriptRole): string {
	return `script[type="${AERO_JSON_SCRIPT_TYPE}"][data-aero="${role}"]`
}

/** Opening tag for an Aero JSON script payload (caller supplies escaped JSON body + closing tag). */
export function aeroJsonScriptOpenTag(role: AeroJsonScriptRole): string {
	return `<script type="${AERO_JSON_SCRIPT_TYPE}" data-aero="${role}">`
}

/**
 * Codegen template literal for a complete Aero JSON script tag.
 *
 * @param role - `props` or `state`
 * @param jsonExpr - JavaScript expression evaluating to serialized JSON (e.g. `escapeScriptJson(...)`)
 */
export function emitAeroJsonScriptTagTemplate(role: AeroJsonScriptRole, jsonExpr: string): string {
	return `\`${aeroJsonScriptOpenTag(role)}\${${jsonExpr}}</script>\``
}
