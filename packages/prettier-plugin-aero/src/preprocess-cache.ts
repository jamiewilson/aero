import type { AeroPluginOptions } from './options.js'
import type { AeroExpressionFormatting } from './options.js'

const MAX_ENTRIES = 50

type CacheEntry = { key: string; value: string }

const cache: CacheEntry[] = []

function hashPreprocessKey(
	source: string,
	aeroOptions: AeroPluginOptions,
	expressionFormatting: AeroExpressionFormatting,
	prettierFingerprint: string
): string {
	return `${source}\0${aeroOptions.aeroAttributePrefix}\0${aeroOptions.aeroBracketSpacing}\0${aeroOptions.aeroSelfClosingComponents}\0${expressionFormatting}\0${prettierFingerprint}`
}

export function prettierOptionsFingerprint(options: Record<string, unknown>): string {
	return JSON.stringify({
		semi: options.semi,
		singleQuote: options.singleQuote,
		trailingComma: options.trailingComma,
		useTabs: options.useTabs,
		tabWidth: options.tabWidth,
		printWidth: options.printWidth,
	})
}

export function getPreprocessCache(
	source: string,
	aeroOptions: AeroPluginOptions,
	expressionFormatting: AeroExpressionFormatting,
	prettierFingerprint: string
): string | undefined {
	const key = hashPreprocessKey(source, aeroOptions, expressionFormatting, prettierFingerprint)
	const hit = cache.find(entry => entry.key === key)
	return hit?.value
}

export function setPreprocessCache(
	source: string,
	aeroOptions: AeroPluginOptions,
	expressionFormatting: AeroExpressionFormatting,
	prettierFingerprint: string,
	result: string
): void {
	const key = hashPreprocessKey(source, aeroOptions, expressionFormatting, prettierFingerprint)
	const existing = cache.findIndex(entry => entry.key === key)
	if (existing >= 0) cache.splice(existing, 1)
	cache.push({ key, value: result })
	if (cache.length > MAX_ENTRIES) cache.shift()
}

/** @internal Test helper */
export function clearPreprocessCacheForTests(): void {
	cache.length = 0
}
