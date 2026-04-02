/**
 * Build codegen fragments for bundled client `<script>` tags (virtual URL vs literal, pass-data, head vs body).
 */

import type { ScriptEntry } from './types'

export const VIRTUAL_PREFIX = '/@aero/client/'

/** HTML `type` attribute is case-insensitive; avoid duplicating `type="module"` when author used e.g. `TYPE="module"`. */
function hasTypeAttribute(attrs: string): boolean {
	return /\btype\s*=/i.test(attrs)
}

/**
 * Returns lines to push onto `headScripts` / `rootScripts` in `compile()` for one client script entry.
 */
export function emitClientScriptTag(
	clientScript: ScriptEntry,
	virtualPrefix: string
): { head: string[]; root: string[] } {
	const head: string[] = []
	const root: string[] = []

	const attrs = clientScript.attrs ?? ''
	const hasType = hasTypeAttribute(attrs)
	const baseAttrs = hasType ? attrs : `type="module"${attrs ? ' ' + attrs : ''}`
	const urlExpr = clientScript.content.startsWith(virtualPrefix)
		? `__aeroScriptUrl(${JSON.stringify(clientScript.content.slice(virtualPrefix.length))})`
		: JSON.stringify(clientScript.content)
	const tagExpr = `Aero.createScriptTag(${JSON.stringify(baseAttrs)}, ${urlExpr})`
	const isHead = clientScript.injectInHead

	if (clientScript.passDataExpr) {
		const jsonExpr = `escapeScriptJson(${clientScript.passDataExpr})`
		const bridgeScript =
			'<script>(function(){var __aero_prev=document.currentScript&&document.currentScript.previousElementSibling;window.__aero_data_next=__aero_prev&&__aero_prev.tagName==="SCRIPT"&&__aero_prev.getAttribute("type")==="application/json"?JSON.parse(__aero_prev.textContent):{};})();</' +
			'script>'
		if (isHead) {
			head.push(
				`(function(){return '<script type="application/json" class="__aero_data">'+${jsonExpr}+'</'+'script>'+${JSON.stringify(bridgeScript)}+(${tagExpr});})()`
			)
		} else {
			root.push(
				`(function(){scripts?.add(\`<script type="application/json" class="__aero_data">\${${jsonExpr}}</script>\`);scripts?.add(${JSON.stringify(bridgeScript)});scripts?.add(${tagExpr});})();`
			)
		}
	} else {
		if (isHead) {
			head.push(tagExpr)
		} else {
			root.push(`scripts?.add(${tagExpr});`)
		}
	}

	return { head, root }
}
