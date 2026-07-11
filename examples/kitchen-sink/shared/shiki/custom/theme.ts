type RehypePluginTuple = [plugin: any, ...parameters: any[]]
import rehypeShiki from '@shikijs/rehype'
import shikiConfig from '@shared/shiki/config'
import { addPreNotProseReyhype } from '@shared/shiki/custom'

export default function customTheme(): RehypePluginTuple {
	return [[rehypeShiki, { ...shikiConfig, inline: 'tailing-curly-colon' }], addPreNotProseReyhype]
}
