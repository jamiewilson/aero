import type {
	BundledLanguage,
	BundledTheme,
	LanguageInput,
	ShikiTransformer,
	StringLiteralUnion,
	ThemeRegistrationAny,
} from 'shiki'

/**
 * Single-theme configuration: one theme applied to all code output.
 *
 * @remarks
 * Wraps Shiki's `CodeOptionsSingleTheme` with `BundledTheme` autocomplete.
 *
 * @example
 * ```ts
 * const config: ShikiConfig = {
 *   theme: 'github-light',
 * }
 * ```
 *
 * @see https://shiki.style/guide — Shiki guide
 */
export interface ShikiConfigSingleTheme {
	/** Theme name or registration object. */
	theme: ThemeRegistrationAny | StringLiteralUnion<BundledTheme>
	themes?: never
}

/**
 * Multi-theme configuration: multiple named themes with CSS variable output.
 *
 * @remarks
 * Wraps Shiki's `CodeOptionsMultipleThemes` with `BundledTheme` autocomplete.
 * Use `themes: { light: '...', dark: '...' }` for dual-theme mode.
 * Additional named themes are supported (e.g. `sepia`, `high-contrast`).
 *
 * @example
 * ```ts
 * const config: ShikiConfig = {
 *   themes: {
 *     light: 'github-light',
 *     dark: 'github-dark',
 *   },
 * }
 * ```
 *
 * @see https://shiki.style/guide/dual-themes — Dual themes guide
 */
export interface ShikiConfigMultipleThemes {
	theme?: never
	/**
	 * A map of color names to themes.
	 *
	 * @see https://shiki.style/guide/dual-themes
	 */
	themes: Partial<Record<string, ThemeRegistrationAny | StringLiteralUnion<BundledTheme>>>

	/**
	 * The default theme applied via inline `color` style.
	 * Other themes use CSS variables toggled by CSS overrides.
	 *
	 * @remarks
	 * - `'light'` (default): Light theme gets inline color.
	 * - `'dark'`: Dark theme gets inline color.
	 * - `false`: No default styles; all themes via CSS variables.
	 * - `'light-dark()'`: Modern CSS `light-dark()` function.
	 *
	 * @defaultValue `'light'`
	 */
	defaultColor?: StringLiteralUnion<'light' | 'dark'> | 'light-dark()' | false

	/**
	 * Strategy to render multiple colors.
	 *
	 * - `'css-vars'`: Render via CSS variables (default).
	 * - `'none'`: Only use the default color.
	 *
	 * @defaultValue `'css-vars'`
	 */
	colorsRendering?: 'css-vars' | 'none'

	/**
	 * Prefix for CSS variables used to store theme colors.
	 *
	 * @defaultValue `'--shiki-'`
	 */
	cssVariablePrefix?: string
}

/**
 * Shiki highlighting configuration.
 *
 * @remarks
 * Wraps Shiki's standard options with full `BundledTheme` and `BundledLanguage`
 * autocomplete. Supports both single-theme and multi-theme modes using Shiki's
 * native `theme`/`themes` discriminated union.
 *
 * @example Single theme
 * ```ts
 * const config: ShikiConfig = {
 *   theme: 'github-light',
 *   langs: ['js', 'ts', 'html'],
 * }
 * ```
 *
 * @example Dual themes (light/dark)
 * ```ts
 * const config: ShikiConfig = {
 *   themes: { light: 'github-light', dark: 'github-dark' },
 *   langs: ['js', 'ts', 'html'],
 * }
 * ```
 *
 * @see https://shiki.style/guide — Shiki guide
 * @see https://shiki.style/themes — Available themes
 * @see https://shiki.style/guide/transformers — Transformer plugins
 */
export type ShikiConfig = (ShikiConfigSingleTheme | ShikiConfigMultipleThemes) & {
	/**
	 * Languages to preload. Accepts bundled language IDs or custom `LanguageInput` registrations.
	 * If omitted, a default set is loaded: `['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'bash']`.
	 *
	 * @defaultValue `['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'bash']`
	 * @see https://shiki.style/languages — Available languages
	 */
	langs?: (BundledLanguage | LanguageInput)[]

	/**
	 * Alias of languages.
	 *
	 * @example `{ 'my-lang': 'javascript' }`
	 */
	langAlias?: Record<string, StringLiteralUnion<BundledLanguage>>

	/**
	 * Transformers for post-processing highlighted code.
	 * Supports line highlighting, focus, diffs, line numbers, and more.
	 *
	 * @see https://shiki.style/guide/transformers
	 *
	 * @example
	 * ```ts
	 * import { transformerNotationHighlight } from '@shikijs/transformers'
	 *
	 * const config: ShikiConfig = {
	 *   theme: 'github-light',
	 *   transformers: [transformerNotationHighlight()],
	 * }
	 * ```
	 */
	transformers?: ShikiTransformer[]
}
