import { aeroHtml, addPreDataLang, addPreNotProse, type ShikiConfig } from '@aero-js/highlight'
import { applyOverrides } from './shiki-utils.ts'
import { withItalics } from './shiki-italic.ts'
import { withCommentColor } from './shiki-comments.ts'
import lightTheme from '@shikijs/themes/github-light'
import darkTheme from '@shikijs/themes/github-dark-high-contrast'

export const shikiOptions: ShikiConfig = {
	themes: {
		light: applyOverrides(lightTheme, withItalics, withCommentColor),
		dark: applyOverrides(darkTheme, withItalics, withCommentColor),
	},
	defaultColor: 'light-dark()' as const,
	langs: ['js', 'ts', 'html', 'css', 'json', 'bash', aeroHtml],
	transformers: [addPreDataLang(), addPreNotProse()],
}
