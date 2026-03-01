/**
 * Shared markdown processor: remark pipeline with optional Shiki syntax highlighting.
 *
 * @remarks
 * Both `compileMarkdown` (eager, for transforms) and `render` (lazy, for pages) delegate to
 * this module. Call `initProcessor(shikiConfig)` once at startup (from the Vite plugin) to
 * enable Shiki; omit the config for plain `remark-html` output (backward compatible).
 *
 * The processor is created lazily on first use if `initProcessor` was never called.
 */
import type { ShikiConfig } from '@aerobuilt/highlight'
import type { Processor } from 'unified'
import { remark } from 'remark'
import remarkHtml from 'remark-html'

// Use global to persist processor state across module reloads (e.g., Vite + Nitro)
declare global {
	var __aeroProcessorState: {
		processor: Processor | null
		initialized: boolean
	}
}

if (!globalThis.__aeroProcessorState) {
	globalThis.__aeroProcessorState = {
		processor: null,
		initialized: false,
	}
}

/**
 * Create the plain remark-html processor (no syntax highlighting).
 * This is the default when no Shiki config is provided.
 */
function createPlainProcessor(): Processor {
	return remark().use(remarkHtml) as unknown as Processor
}

/**
 * Create a Shiki-enabled processor: remark → remark-rehype → @shikijs/rehype → rehype-stringify.
 *
 * @remarks
 * Dynamically imports rehype dependencies so they are only loaded when Shiki is configured.
 * Uses `rehypeShikiFromHighlighter` from `@shikijs/rehype/core` with the cached highlighter
 * from `@aerobuilt/highlight`.
 *
 * @param config - Shiki configuration (themes, languages, transformers).
 */
/**
 * Extract the theme options to pass to the rehype plugin from a ShikiConfig.
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

async function createShikiProcessor(config: ShikiConfig): Promise<Processor> {
	const { getHighlighter } = await import('@aerobuilt/highlight')
	const remarkRehype = (await import('remark-rehype')).default
	const rehypeShikiFromHighlighter = (await import('@shikijs/rehype/core')).default
	const rehypeStringify = (await import('rehype-stringify')).default

	const highlighter = await getHighlighter(config)

	return remark()
		.use(remarkRehype)
		.use(rehypeShikiFromHighlighter, highlighter, {
			...extractThemeOptions(config),
			transformers: config.transformers ?? [],
		} as any)
		.use(rehypeStringify) as unknown as Processor
}

/**
 * Initialize the shared markdown processor.
 *
 * @remarks
 * Call once at startup (typically from the Vite plugin's configResolved hook) before any
 * markdown compilation occurs. If `shikiConfig` is provided, code blocks in markdown
 * will be syntax-highlighted. If omitted, plain `<pre><code>` output is produced.
 *
 * Safe to call multiple times — subsequent calls replace the processor.
 *
 * @param shikiConfig - Optional Shiki configuration. Omit for plain HTML output.
 */
export async function initProcessor(shikiConfig?: ShikiConfig): Promise<void> {
	if (shikiConfig) {
		globalThis.__aeroProcessorState.processor = await createShikiProcessor(shikiConfig)
	} else {
		globalThis.__aeroProcessorState.processor = createPlainProcessor()
	}
	globalThis.__aeroProcessorState.initialized = true
}

/**
 * Get the shared markdown processor.
 *
 * @remarks
 * Returns the processor created by `initProcessor`. If `initProcessor` was never called,
 * lazily creates the plain remark-html fallback (backward compat for direct imports of
 * `compileMarkdown` or `render` without going through the Vite plugin).
 *
 * @returns The unified processor instance.
 */
export function getProcessor(): Processor {
	if (!globalThis.__aeroProcessorState.processor) {
		globalThis.__aeroProcessorState.processor = createPlainProcessor()
		globalThis.__aeroProcessorState.initialized = true
	}
	return globalThis.__aeroProcessorState.processor
}

/**
 * Reset the processor state. Intended for testing only.
 */
export function resetProcessor(): void {
	globalThis.__aeroProcessorState.processor = null
	globalThis.__aeroProcessorState.initialized = false
}
