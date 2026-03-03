/**
 * Shared markdown processor: unified rehype pipeline with pluggable remark and rehype plugins.
 *
 * @remarks
 * Both `compileMarkdown` (eager, for transforms) and `render` (lazy, for pages) delegate to
 * this module. Call `initProcessor(config)` once at startup (from the Vite plugin) to
 * configure the pipeline. The pipeline is always rehype-based:
 *
 * `remark` -> `[remarkPlugins]` -> `remark-rehype` -> `[rehypePlugins]` -> `rehype-stringify`
 *
 * The processor is created lazily on first use if `initProcessor` was never called.
 */
import type { Pluggable, Processor } from 'unified'
import type { MarkdownConfig } from './types'
import { remark } from 'remark'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

/**
 * Processor config: remark and rehype plugin arrays.
 *
 * @remarks
 * Mirrors the `markdown` slice of `ContentConfig` so that the processor does not
 * depend on the full config shape.
 */
export type ProcessorConfig = MarkdownConfig

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
 * Create the unified processor pipeline.
 *
 * @remarks
 * Always uses the rehype path: remark -> remarkPlugins -> remark-rehype -> rehypePlugins -> rehype-stringify.
 * Without any rehype plugins, code blocks render as plain `<pre><code>`.
 */
function applyPlugins(pipeline: any, plugins: Pluggable[]): any {
	for (const entry of plugins) {
		if (Array.isArray(entry)) {
			const [plugin, ...options] = entry as [any, ...any[]]
			pipeline = pipeline.use(plugin, ...options)
		} else {
			pipeline = pipeline.use(entry as any)
		}
	}
	return pipeline
}

function createProcessor(
	remarkPlugins: Pluggable[] = [],
	rehypePlugins: Pluggable[] = [],
): Processor {
	let pipeline = remark() as any

	pipeline = applyPlugins(pipeline, remarkPlugins)
	pipeline = pipeline.use(remarkRehype)
	pipeline = applyPlugins(pipeline, rehypePlugins)

	return pipeline.use(rehypeStringify) as unknown as Processor
}

/**
 * Initialize the shared markdown processor.
 *
 * @remarks
 * Call once at startup (typically from the Vite plugin's configResolved hook) before any
 * markdown compilation occurs. Pass remark/rehype plugins to extend the pipeline (e.g.
 * add `@shikijs/rehype` or `rehype-pretty-code` for syntax highlighting).
 *
 * Safe to call multiple times — subsequent calls replace the processor.
 *
 * @param config - Optional markdown plugin configuration.
 */
export async function initProcessor(config?: ProcessorConfig): Promise<void> {
	globalThis.__aeroProcessorState.processor = createProcessor(
		config?.remarkPlugins ?? [],
		config?.rehypePlugins ?? [],
	)
	globalThis.__aeroProcessorState.initialized = true
}

/**
 * Get the shared markdown processor.
 *
 * @remarks
 * Returns the processor created by `initProcessor`. If `initProcessor` was never called,
 * lazily creates a default processor (no plugins).
 *
 * @returns The unified processor instance.
 */
export function getProcessor(): Processor {
	if (!globalThis.__aeroProcessorState.processor) {
		globalThis.__aeroProcessorState.processor = createProcessor()
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
