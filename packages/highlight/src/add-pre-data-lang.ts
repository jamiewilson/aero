import type { ShikiTransformer } from 'shiki'

/**
 * Add `data-lang` to the generated `<pre>` element using the requested language token.
 *
 * @remarks
 * Opt-in via Shiki `transformers`. The value uses the raw requested language (including aliases).
 */
export function addPreDataLang(): ShikiTransformer {
	return {
		name: 'aero-js:pre-data-lang-transformer',
		pre(node) {
			const lang = this.options.lang
			if (!lang) return
			node.properties ??= {}
			node.properties['data-lang'] = String(lang)
		},
	}
}
