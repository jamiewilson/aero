import { aeroHtml, addPreDataLang } from '@aero-js/highlight'
import { customDarkTheme, customLightTheme } from './shiki-custom-comments.ts'
import rehypeShiki from '@shikijs/rehype'

type RehypePluginTuple = [plugin: any, ...parameters: any[]]

/**
 * Returns the website's configured Shiki rehype plugin tuple.
 */
export function customShikiTheme() {
	return [
		rehypeShiki,
		{
			themes: {
				light: customLightTheme,
				dark: customDarkTheme,
			},
			defaultColor: 'light-dark()',
			inline: 'tailing-curly-colon',
			langs: ['js', 'ts', 'html', 'css', 'json', 'bash', aeroHtml],
			transformers: [addPreDataLang()],
		},
	] as RehypePluginTuple
}
