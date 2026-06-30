import type { StateBinding, StateScriptAnalysisResult } from './state-script-analysis'

function escapeInlineScript(content: string): string {
	return content.replace(/<\//g, '<\\/')
}

function storageApi(storage?: 'local' | 'session'): string {
	return storage === 'session' ? 'sessionStorage' : 'localStorage'
}

function namespacedKeyExpr(persist: NonNullable<StateBinding['persist']>): string {
	if (persist.key) return JSON.stringify(`aero:${persist.key}`)
	return `"aero:" + (${persist.keyExpr})`
}

function attributeExpr(persist: NonNullable<StateBinding['persist']>): string | null {
	if (persist.attribute) return JSON.stringify(persist.attribute)
	if (persist.attributeExpr) return persist.attributeExpr
	return null
}

function emitCriticalSnippet(binding: StateBinding): string | null {
	const persist = binding.persist
	if (!persist?.critical) return null
	const attr = attributeExpr(persist)
	if (!attr) return null
	const storage = storageApi(persist.storage)
	const key = namespacedKeyExpr(persist)
	const fallback = persist.defaultExpr
	return `(function(){try{var v=JSON.parse(${storage}.getItem(${key}));if(v==null)v=${fallback};document.documentElement.setAttribute(${attr},v);}catch(e){}})();`
}

/** Emit render-fn lines that prepend sync critical persist scripts at the start of `<head>`. */
export function emitCriticalPersistHeadScriptLines(analysis: StateScriptAnalysisResult): string[] {
	const snippets = analysis.bindings
		.filter(binding => !binding.derived && !binding.reactiveProp && binding.persist?.critical)
		.map(binding => emitCriticalSnippet(binding))
		.filter((snippet): snippet is string => snippet !== null)
	if (snippets.length === 0) return []
	const scriptBody = escapeInlineScript(snippets.join(''))
	return [`\`<script>${scriptBody}</script>\``]
}
