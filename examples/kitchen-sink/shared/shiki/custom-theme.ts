import { shikiOptions, colorReplacements } from './shiki-options.ts'
import rehypeShiki from '@shikijs/rehype'
type RehypePluginTuple = [plugin: any, ...parameters: any[]]

export function customTheme(): RehypePluginTuple {
	return [rehypeShiki, { ...shikiOptions, colorReplacements }]
}
