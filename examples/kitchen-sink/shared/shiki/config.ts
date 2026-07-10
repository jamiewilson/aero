import {
	type ShikiConfig,
	addPreDataLang,
	addPreNotProse,
	DEFAULT_LANGS,
	aeroHtml,
} from '@aero-js/highlight'

import {
	transformerNotationHighlight,
	transformerNotationWordHighlight,
} from '@shikijs/transformers'

import { addCopyButton } from 'shiki-transformer-copy-button'

import { applyOverrides } from './utils.ts'
import withItalics from './with-italics.ts'
import withCommentColor from './with-comment-color.ts'
import lightTheme from '@shikijs/themes/github-light'
import darkTheme from '@shikijs/themes/github-dark-high-contrast'

const shikiConfig: ShikiConfig = {
	themes: {
		light: applyOverrides(lightTheme, withItalics, withCommentColor),
		dark: applyOverrides(darkTheme, withItalics, withCommentColor),
	},
	defaultColor: 'light-dark()' as const,
	langs: [...DEFAULT_LANGS, 'sh', 'md', aeroHtml],
	transformers: [
		addPreDataLang(),
		addPreNotProse(),
		transformerNotationHighlight(),
		transformerNotationWordHighlight(),
		addCopyButton(),
	],
}

export default shikiConfig
