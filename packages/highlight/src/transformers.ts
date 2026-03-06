import type { ShikiTransformer } from 'shiki'

/**
 * Add `data-lang` to the generated `<pre>` element using the requested language token.
 *
 * @remarks
 * This is opt-in and preserves existing output unless explicitly added to
 * `transformers`. The emitted value uses the raw requested language (including aliases).
 */
export function preDataLangTransformer(): ShikiTransformer {
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
