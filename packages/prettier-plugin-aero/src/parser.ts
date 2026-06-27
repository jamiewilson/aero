import { parseMinimalHtmlFromText } from '@aero-js/html-parser'
import type { ParserOptions } from 'prettier'
import * as prettierPluginHtml from 'prettier/plugins/html'
import { applyAeroTransforms } from './transforms.js'
import {
	resolveAeroOptions,
	type AeroExpressionFormatting,
	type AeroPluginOptions,
} from './options.js'
import { logAeroPrettierTiming } from './dev-timing.js'
import {
	getPreprocessCache,
	prettierFormatOptionsFingerprint,
	setPreprocessCache,
} from './preprocess-cache.js'
import { performance } from 'node:perf_hooks'

const htmlParser = prettierPluginHtml.parsers.html

function resolveExpressionFormatting(
	options: ParserOptions & Partial<AeroPluginOptions>
): AeroExpressionFormatting {
	return options.aeroExpressionFormatting ?? 'full'
}

export const aeroParser = {
	...htmlParser,
	astFormat: 'html' as const,
	async preprocess(
		text: string,
		options: ParserOptions & Partial<AeroPluginOptions>
	): Promise<string> {
		const preprocessStart = performance.now()
		const aeroOptions = resolveAeroOptions(options)
		const expressionFormatting = resolveExpressionFormatting(options)
		const prettierFingerprint = prettierFormatOptionsFingerprint(options as Record<string, unknown>)

		const cached = getPreprocessCache(text, aeroOptions, expressionFormatting, prettierFingerprint)
		if (cached !== undefined) {
			logAeroPrettierTiming('preprocess-cache-hit', preprocessStart)
			return cached
		}

		const parseStart = performance.now()
		const document = parseMinimalHtmlFromText(text)
		logAeroPrettierTiming('preprocess-parse', parseStart)

		const result = await applyAeroTransforms(
			text,
			document.roots,
			aeroOptions,
			options,
			expressionFormatting
		)

		setPreprocessCache(text, aeroOptions, expressionFormatting, prettierFingerprint, result)
		logAeroPrettierTiming('preprocess-total', preprocessStart)
		return result
	},
}
