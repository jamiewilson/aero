import { ThemeMode } from '@content/theme'

export default {
	meta: {
		title: 'Aero',
		description:
			'A static site generator and full-stack framework with an HTML-first template engine.',
		ogImage: '/aero.png',
		icon: {
			ico: '/favicon.ico',
			svg: '/favicon.svg',
			apple: '/apple-touch-icon.png',
		},
	},
	theme: {
		options: Object.values(ThemeMode),
		default: ThemeMode.System,
		storageKey: 'theme',
		attribute: 'data-theme',
	},
	toc: [
		{ label: 'Try it out', href: '#try-it-out' },
		{ label: 'The Basics', href: '#the-basics' },
		{ label: 'File-based routing', href: '#file-based-routing' },
		{ label: 'Components & Layouts', href: '#components--layouts' },
		{ label: 'Props', href: '#props' },
		{ label: 'Loops & conditionals', href: '#loops--conditionals' },
		{ label: 'Slots', href: '#slots' },
		{ label: 'Content Collections', href: '#content-collections' },
		{ label: 'Server when you need it', href: '#server-when-you-need-it' },
		{ label: 'Plain HTML output', href: '#plain-html-output' },
		{ label: 'Configuration', href: '#configuration' },
		{ label: 'Commands', href: '#commands' },
		{ label: 'Build output', href: '#build-output' },
		{ label: 'VS Code Extension', href: '#vs-code-extension' },
		{ label: 'More Documentation', href: '#more-documentation' },
		{ label: 'Links', href: '#links' },
		{ label: 'Inspiration', href: '#inspiration' },
	],
}
