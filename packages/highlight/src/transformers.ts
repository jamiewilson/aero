import type { ShikiTransformer } from 'shiki'

/**
 * Add `data-lang` to the generated `<pre>` element using the requested language token.
 *
 * @remarks
 * This is opt-in and preserves existing output unless explicitly added to
 * `transformers`. The emitted value uses the raw requested language (including aliases).
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

/**
 * Add `not-prose` to the generated `<pre>` element.
 *
 * @remarks
 * Opt-in helper for Tailwind Typography: prose skips elements with `not-prose`.
 * Uses Shiki's `addClassToHast` so classes merge with Shiki's own `pre` classes.
 */
export function addPreNotProse(): ShikiTransformer {
	return {
		name: 'aero-js:pre-not-prose-transformer',
		pre(node) {
			this.addClassToHast(node, 'not-prose')
		},
	}
}
