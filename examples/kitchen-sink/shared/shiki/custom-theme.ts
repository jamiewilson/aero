import { shikiOptions } from './shiki-options.ts'
import rehypeShiki from '@shikijs/rehype'
type RehypePluginTuple = [plugin: any, ...parameters: any[]]

export function customTheme(): RehypePluginTuple {
	return [
		rehypeShiki,
		{
			...shikiOptions,
			inline: 'tailing-curly-colon',
			colorReplacements: {
				'github-light': {
					'#fff': 'var(--code-light-bg)',
				},
				'github-dark-high-contrast': {
					'#0a0c10': 'var(--code-dark-bg)',
				},
			},
		},
	]
}
