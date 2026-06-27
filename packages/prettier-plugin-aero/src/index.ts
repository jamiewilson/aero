import type { Plugin } from 'prettier'
import * as prettierPluginHtml from 'prettier/plugins/html'
import { aeroParser } from './parser.js'
import { aeroOptions } from './options.js'

const plugin: Plugin = {
	languages: [
		{
			name: 'Aero HTML',
			parsers: ['aero'],
			extensions: ['.html'],
			vscodeLanguageIds: ['aero', 'html'],
		},
	],
	options: aeroOptions,
	parsers: {
		aero: aeroParser,
	},
	printers: {
		html: prettierPluginHtml.printers.html,
	},
}

export default plugin
export { aeroOptions, aeroParser }
export type { AeroPluginOptions } from './options.js'
export {
	BUILD_DIRECTIVES,
	isBuildDirectiveAttribute,
} from '@aero-js/compiler/build-directive-attributes'
export { isSelfClosingComponentTag } from './directives.js'
export { applyAeroTransforms } from './transforms.js'
