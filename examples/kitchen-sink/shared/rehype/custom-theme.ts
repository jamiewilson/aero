type RehypePluginTuple = [plugin: any, ...parameters: any[]]
import rehypeShiki from '@shikijs/rehype'
import shikiConfig from '../shiki/config.ts'

export default function customTheme(): RehypePluginTuple {
	return [
		rehypeShiki,
		{
			...shikiConfig,
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
