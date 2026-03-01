import type { HighlighterGeneric } from 'shiki'
import type { ShikiConfig } from './types'
import { createHighlighter as shikiCreateHighlighter } from 'shiki'

const DEFAULT_LANGUAGES = ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'bash']

/** Cached highlighter instance (created once per config). */
let cachedHighlighter: HighlighterGeneric<any, any> | null = null
let cachedConfigKey: string | null = null

/**
 * Build a stable cache key from config (theme names + lang names only).
 *
 * @remarks
 * Avoids `JSON.stringify` which silently drops function values like transformers,
 * producing identical keys for configs that differ only in transformers.
 */
function buildCacheKey(config: ShikiConfig): string {
	const themeKey =
		'theme' in config && config.theme
			? String(typeof config.theme === 'string' ? config.theme : 'custom')
			: 'themes' in config && config.themes
				? Object.entries(config.themes)
						.sort(([a], [b]) => a.localeCompare(b))
						.map(([k, v]) => `${k}:${typeof v === 'string' ? v : 'custom'}`)
						.join(',')
				: 'none'

	const langKey = (config.langs ?? DEFAULT_LANGUAGES)
		.map(l => (typeof l === 'string' ? l : 'custom'))
		.sort()
		.join(',')

	const aliasKey = config.langAlias
		? Object.entries(config.langAlias)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([k, v]) => `${k}=${v}`)
				.join(',')
		: ''

	return `${themeKey}|${langKey}|${aliasKey}`
}

/**
 * Extract the list of theme inputs to preload from a config.
 */
function extractThemes(config: ShikiConfig): (string | object)[] {
	if ('theme' in config && config.theme) {
		return [config.theme]
	}
	if ('themes' in config && config.themes) {
		return Object.values(config.themes).filter(Boolean) as (string | object)[]
	}
	return []
}

/**
 * Get or create a shared Shiki highlighter instance.
 *
 * @remarks
 * The highlighter is cached at the module level and reused across renders
 * for performance. A new instance is created only when the config changes
 * (based on theme names and language list).
 *
 * @param config - Shiki highlighting configuration.
 * @returns Cached or newly created highlighter.
 */
export async function getHighlighter(
	config: ShikiConfig,
): Promise<HighlighterGeneric<any, any>> {
	const configKey = buildCacheKey(config)

	if (cachedHighlighter && cachedConfigKey === configKey) {
		return cachedHighlighter
	}

	const themes = extractThemes(config)
	const langs = config.langs ?? DEFAULT_LANGUAGES

	cachedHighlighter = await shikiCreateHighlighter({
		themes,
		langs,
		...(config.langAlias ? { langAlias: config.langAlias } : {}),
	})
	cachedConfigKey = configKey

	return cachedHighlighter
}

/**
 * Extract the theme options to pass to `codeToHtml` from a config.
 *
 * @remarks
 * Returns the correct shape for Shiki's discriminated union:
 * `{ theme }` for single-theme, or `{ themes, defaultColor?, cssVariablePrefix?, colorsRendering? }`
 * for multi-theme.
 */
function extractThemeOptions(config: ShikiConfig): Record<string, any> {
	if ('theme' in config && config.theme) {
		return { theme: config.theme }
	}
	if ('themes' in config && config.themes) {
		const opts: Record<string, any> = { themes: config.themes }
		// Only include multi-theme options if 'themes' is present (ShikiConfigMultipleThemes)
		if ('defaultColor' in config && config.defaultColor !== undefined) {
			opts.defaultColor = config.defaultColor
		}
		if ('cssVariablePrefix' in config && config.cssVariablePrefix !== undefined) {
			opts.cssVariablePrefix = config.cssVariablePrefix
		}
		if ('colorsRendering' in config && config.colorsRendering !== undefined) {
			opts.colorsRendering = config.colorsRendering
		}
		return opts
	}
	return {}
}

/**
 * Highlight a code string with Shiki.
 *
 * @remarks
 * Creates or reuses a cached highlighter, then renders the code to HTML.
 * In multi-theme mode, Shiki emits CSS variables for theme switching.
 *
 * @param code - Source code to highlight.
 * @param language - Language ID (e.g. `'js'`, `'python'`).
 * @param config - Shiki highlighting configuration.
 * @returns Highlighted HTML string.
 */
export async function highlight(
	code: string,
	language: string,
	config: ShikiConfig,
): Promise<string> {
	const highlighter = await getHighlighter(config)

	return highlighter.codeToHtml(code, {
		lang: language,
		...extractThemeOptions(config),
		transformers: config.transformers ?? [],
	} as Parameters<typeof highlighter.codeToHtml>[1])
}

/**
 * Reset the cached highlighter.
 * Useful for testing or when config changes between processes.
 */
export function resetHighlighter(): void {
	cachedHighlighter = null
	cachedConfigKey = null
}
