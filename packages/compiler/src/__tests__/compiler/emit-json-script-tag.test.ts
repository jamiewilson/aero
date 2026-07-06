import { describe, expect, it } from 'vitest'
import {
	AERO_JSON_ROLE_PROPS,
	AERO_JSON_ROLE_STATE,
	AERO_JSON_SCRIPT_TYPE,
	aeroJsonScriptOpenTag,
	aeroJsonScriptRoleSelector,
	emitAeroJsonScriptTagTemplate,
} from '../../json-script-payload'

describe('json-script-payload', () => {
	it('defines application/json type and role selectors', () => {
		expect(AERO_JSON_SCRIPT_TYPE).toBe('application/json')
		expect(aeroJsonScriptRoleSelector(AERO_JSON_ROLE_STATE)).toBe(
			'script[type="application/json"][data-aero="state"]'
		)
		expect(aeroJsonScriptRoleSelector(AERO_JSON_ROLE_PROPS)).toBe(
			'script[type="application/json"][data-aero="props"]'
		)
	})

	it('emitAeroJsonScriptTagTemplate wraps jsonExpr in a template literal', () => {
		expect(emitAeroJsonScriptTagTemplate(AERO_JSON_ROLE_STATE, 'escapeScriptJson(snapshot)')).toBe(
			'`<script type="application/json" data-aero="state">${escapeScriptJson(snapshot)}</script>`'
		)
	})

	it('aeroJsonScriptOpenTag matches emit template opening', () => {
		expect(aeroJsonScriptOpenTag(AERO_JSON_ROLE_PROPS)).toBe(
			'<script type="application/json" data-aero="props">'
		)
	})
})
