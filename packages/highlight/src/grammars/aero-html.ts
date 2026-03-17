import type { LanguageInput } from 'shiki'

/**
 * Injection pattern for `{ ... }` expressions in HTML attribute strings.
 * Highlights the inner content as TypeScript (e.g. `props="{ title: site.title }"`).
 */
const aeroExpressionPattern = {
	begin: '\\{',
	end: '\\}',
	beginCaptures: {
		'0': { name: 'punctuation.section.embedded.begin.aero' },
	},
	endCaptures: {
		'0': { name: 'punctuation.section.embedded.end.aero' },
	},
	contentName: 'meta.embedded.expression.aero source.ts',
	patterns: [
		{
			comment: 'Handle object literals that start with { so nested braces are parsed correctly',
			begin: '\\G\\s*(?=\\{)',
			end: '(?<=\\})',
			patterns: [{ include: 'source.ts#object-literal' }],
		},
		{ include: 'source.ts' },
	],
}

/**
 * Aero HTML grammar for Shiki.
 *
 * Extends HTML with injection rules that highlight JavaScript/TypeScript inside
 * `{ }` expressions in attribute values (e.g. `props="{ title: site.title }"`).
 *
 * Use with `langs: [..., aeroHtml]` and fenced blocks tagged ` ```html`.
 * Place aeroHtml at the end of the langs array: it aliases to `html`, and Shiki uses the
 * last-registered handler for a given alias, so putting it last ensures ` ```html ` blocks
 * use this extended grammar instead of the base HTML grammar.
 */
export const aeroHtml: LanguageInput = {
	name: 'aero-html',
	aliases: ['html'],
	scopeName: 'text.html.aero',
	patterns: [{ include: 'text.html.basic' }],
	repository: {},
	injections: {
		'string.quoted.double.html': {
			patterns: [aeroExpressionPattern],
		},
		'string.quoted.single.html': {
			patterns: [aeroExpressionPattern],
		},
	},
	embeddedLangs: ['typescript'],
}

/** Language ID for Aero HTML. Use in fenced blocks: ` ```aero-html ` */
export const AERO_HTML_LANG = 'aero-html'
