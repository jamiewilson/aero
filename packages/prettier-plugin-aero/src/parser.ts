import { parseMinimalHtmlFromText } from '@aero-js/html-parser'
import type { ParserOptions } from 'prettier'
import * as prettierPluginHtml from 'prettier/plugins/html'
import { applyAeroTransforms } from './transforms.js'
import { resolveAeroOptions, type AeroPluginOptions } from './options.js'

const htmlParser = prettierPluginHtml.parsers.html

export const aeroParser = {
	...htmlParser,
	astFormat: 'html' as const,
	async preprocess(
		text: string,
		options: ParserOptions & Partial<AeroPluginOptions>
	): Promise<string> {
		const aeroOptions = resolveAeroOptions(options)
		const document = parseMinimalHtmlFromText(text)
		return applyAeroTransforms(text, document.roots, aeroOptions, options)
	},
}
