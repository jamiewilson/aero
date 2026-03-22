/**
 * Keep the plugin's client script map in sync with parsed templates (virtual URLs + HMR invalidation).
 */

import type { ScriptEntry } from '../types'
import { parse } from '../compiler/parser'
import { registerClientScriptsToMap } from './build'
import { CLIENT_SCRIPT_PREFIX } from './defaults'

/** Compare two ScriptEntry records for semantic equality (used to detect client script changes on HMR). */
export function sameScriptEntry(a: ScriptEntry | undefined, b: ScriptEntry | undefined): boolean {
	if (!a || !b) return false
	return (
		a.content === b.content &&
		a.passDataExpr === b.passDataExpr &&
		a.injectInHead === b.injectInHead
	)
}

/** Key prefix for all virtual client script ids emitted from one template. */
function clientScriptPrefixForBase(baseName: string): string {
	return CLIENT_SCRIPT_PREFIX + baseName + '.'
}

/** All virtual client script ids belonging to the same template baseName. */
export function getClientScriptIdsForBase(
	baseName: string,
	target: Map<string, ScriptEntry>
): string[] {
	const prefix = clientScriptPrefixForBase(baseName)
	const ids: string[] = []
	for (const id of target.keys()) {
		if (id.startsWith(prefix)) ids.push(id)
	}
	return ids
}

/**
 * Replace the client script entries for one template and report whether content actually changed.
 * Also returns all potentially affected virtual ids (old and new) for module invalidation.
 */
export function syncClientScriptsForTemplate(
	parsed: ReturnType<typeof parse>,
	baseName: string,
	target: Map<string, ScriptEntry>
): { changed: boolean; affectedIds: string[] } {
	const previousIds = getClientScriptIdsForBase(baseName, target)
	const previousEntries = new Map<string, ScriptEntry>()
	for (const id of previousIds) {
		const existing = target.get(id)
		if (existing) previousEntries.set(id, existing)
		target.delete(id)
	}

	if (parsed.clientScripts.length > 0) {
		registerClientScriptsToMap(parsed, baseName, target)
	}

	const nextIds = getClientScriptIdsForBase(baseName, target)
	let changed = previousIds.length !== nextIds.length
	if (!changed) {
		for (const id of nextIds) {
			if (!sameScriptEntry(previousEntries.get(id), target.get(id))) {
				changed = true
				break
			}
		}
	}

	return {
		changed,
		affectedIds: [...new Set([...previousIds, ...nextIds])],
	}
}
