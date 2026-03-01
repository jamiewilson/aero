import type { ShikiTransformer } from 'shiki'

/**
 * Add `data-lang` to the generated `<pre>` element using the requested language token.
 *
 * @remarks
 * This is opt-in and preserves existing output unless explicitly added to
 * `transformers`. The emitted value uses the raw requested language (including aliases).
 */
export function transformerDataLang(): ShikiTransformer {
	return {
		name: 'aerobuilt:transformer-data-lang',
		pre(node) {
			const lang = this.options.lang
			if (!lang) {
				return
			}

			node.properties ??= {}
			node.properties['data-lang'] = String(lang)
		},
	}
}
