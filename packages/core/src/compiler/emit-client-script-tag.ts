/**
 * Build codegen fragments for bundled client `<script>` tags (virtual URL vs literal, pass-data, head vs body).
 */

import type { ScriptEntry } from '../types'

const VIRTUAL_PREFIX = '/@aero/client/'

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
	const hasType = attrs.includes('type=')
	const baseAttrs = hasType ? attrs : `type="module"${attrs ? ' ' + attrs : ''}`
	const urlExpr = clientScript.content.startsWith(virtualPrefix)
		? `__aeroScriptUrl(${JSON.stringify(clientScript.content.slice(virtualPrefix.length))})`
		: JSON.stringify(clientScript.content)
	const baseAttrsEscaped = baseAttrs.replace(/'/g, "\\'")
	const tagExpr = `'<script ${baseAttrsEscaped} src="'+${urlExpr}+'"></script>'`
	const isHead = clientScript.injectInHead

	if (clientScript.passDataExpr) {
		const jsonExpr = `JSON.stringify(${clientScript.passDataExpr})`
		if (isHead) {
			head.push(
				`(function(){const __pid=Aero.nextPassDataId();\`<\`+'script type="application/json" id="'+__pid+'" class="__aero_data">'+${jsonExpr}+'</'+'script>';window.__aero_data_next=JSON.parse(document.getElementById("'+__pid+'").textContent);})();${tagExpr}`
			)
		} else {
			root.push(
				`(function(){const __pid=Aero.nextPassDataId();scripts?.add(\`<script type="application/json" id="\${__pid}" class="__aero_data">\${${jsonExpr}}</script>\`);scripts?.add(\`<script>window.__aero_data_next=JSON.parse(document.getElementById("\${__pid}").textContent);</script>\`);scripts?.add(${tagExpr});})();`
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

export { VIRTUAL_PREFIX }
