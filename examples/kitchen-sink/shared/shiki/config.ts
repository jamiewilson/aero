import { type ShikiConfig, DEFAULT_LANGS, aeroHtml } from '@aero-js/highlight'

import {
	transformerNotationHighlight,
	transformerNotationWordHighlight,
} from '@shikijs/transformers'

import { addCopyButton } from 'shiki-transformer-copy-button'
import lightTheme from '@shikijs/themes/github-light'
import darkTheme from '@shikijs/themes/github-dark-high-contrast'
import {
	addColors,
	addItalics,
	addPreDataLang,
	addPreNotProseShiki,
	applyOverrides,
} from './custom'

const shikiConfig: ShikiConfig = {
	themes: {
		light: applyOverrides(lightTheme, addItalics, addColors),
		dark: applyOverrides(darkTheme, addItalics, addColors),
	},
	defaultColor: 'light-dark()' as const,
	langs: [...DEFAULT_LANGS, 'sh', 'md', aeroHtml],
	transformers: [
		addPreDataLang(),
		addPreNotProseShiki(),
		transformerNotationHighlight(),
		transformerNotationWordHighlight(),
		addCopyButton(),
	],
}

export default shikiConfig
