import { aeroHtml, addPreDataLang } from '@aero-js/highlight'
import { applyOverrides } from './shiki-utils.ts'
import { withItalics } from './shiki-italic.ts'
import { withCommentColor } from './shiki-comments.ts'

import rehypeShiki from '@shikijs/rehype'
import lightTheme from '@shikijs/themes/github-light'
import darkTheme from '@shikijs/themes/github-dark-high-contrast'

type RehypePluginTuple = [plugin: any, ...parameters: any[]]

export function customTheme() {
	return [
		rehypeShiki,
		{
			themes: {
				light: applyOverrides(lightTheme, withItalics, withCommentColor),
				dark: applyOverrides(darkTheme, withItalics, withCommentColor),
			},
			defaultColor: 'light-dark()',
			inline: 'tailing-curly-colon',
			langs: ['js', 'ts', 'html', 'css', 'json', 'bash', aeroHtml],
			transformers: [addPreDataLang()],
		},
	] as RehypePluginTuple
}
