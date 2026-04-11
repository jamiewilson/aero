/**
 * Build codegen fragments for bundled client `<script>` tags (virtual URL vs literal, pass-data, head vs body).
 */

import type { ScriptEntry } from './types'

export const VIRTUAL_PREFIX = '/@aero/client/'
const PASS_DATA_BRIDGE_SCRIPT =
	'<script>(function(){var __aero_prev=document.currentScript&&document.currentScript.previousElementSibling;window.__aero_data_next=__aero_prev&&__aero_prev.tagName==="SCRIPT"&&__aero_prev.getAttribute("type")==="application/json"?JSON.parse(__aero_prev.textContent):{};})();</' +
	'script>'

function escapeScriptUnsafeChars(str: string): string {
	return str.replace(/[<>\u2028\u2029]/g, ch => {
		switch (ch) {
			case '<':
				return '\\u003C'
			case '>':
				return '\\u003E'
			case '\u2028':
				return '\\u2028'
			case '\u2029':
				return '\\u2029'
			default:
				return ch
		}
	})
}

function stringifyForInlineScript(value: string): string {
	return escapeScriptUnsafeChars(JSON.stringify(value))
}

/** HTML `type` attribute is case-insensitive; avoid duplicating `type="module"` when author used e.g. `TYPE="module"`. */
function hasTypeAttribute(attrs: string): boolean {
	return /\btype\s*=/i.test(attrs)
}

function buildBaseAttrs(attrs: string): string {
	return hasTypeAttribute(attrs) ? attrs : `type="module"${attrs ? ' ' + attrs : ''}`
}

function buildUrlExpr(content: string, virtualPrefix: string): string {
	return content.startsWith(virtualPrefix)
		? `__aeroScriptUrl(${stringifyForInlineScript(content.slice(virtualPrefix.length))})`
		: stringifyForInlineScript(content)
}

function buildTagExpr(attrs: string, content: string, virtualPrefix: string): string {
	const baseAttrs = buildBaseAttrs(attrs)
	const urlExpr = buildUrlExpr(content, virtualPrefix)
	return `Aero.createScriptTag(${stringifyForInlineScript(baseAttrs)}, ${urlExpr})`
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
	const tagExpr = buildTagExpr(attrs, clientScript.content, virtualPrefix)
	const isHead = clientScript.injectInHead

	if (clientScript.passDataExpr) {
		const jsonExpr = `escapeScriptJson(${clientScript.passDataExpr})`
		if (isHead) {
			head.push(
				`(function(){return '<script type="application/json" class="__aero_data">'+${jsonExpr}+'</'+'script>'+${stringifyForInlineScript(PASS_DATA_BRIDGE_SCRIPT)}+(${tagExpr});})()`
			)
		} else {
			root.push(
				`(function(){scripts?.add(\`<script type="application/json" class="__aero_data">\${${jsonExpr}}</script>\`);scripts?.add(${stringifyForInlineScript(PASS_DATA_BRIDGE_SCRIPT)});scripts?.add(${tagExpr});})();`
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
