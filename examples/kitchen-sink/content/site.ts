import { ThemeMode } from '@shared/types/theme'

export default {
	meta: {
		title: 'Site Meta Title',
		description: 'Site Meta Description',
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
	home: {
		title: 'aero',
		subtitle:
			'A static-first, hypermedia-based, full-stack framework for people who love the web platform.',
	},
	demos: [
		{ label: 'Scripts', href: '/demos/scripts' },
		{ label: 'Image imports', href: '/demos/images' },
		{ label: 'Conditionals', href: '/demos/conditionals' },
		{ label: 'Keyed list', href: '/demos/keyed-list' },
		{ label: 'Iterables', href: '/demos/iterables' },
		{ label: 'Form model', href: '/demos/form-model' },
		{ label: 'Bindings', href: '/demos/bindings' },
		{ label: 'Reactivity', href: '/demos/reactivity' },
		{ label: 'Hypermedia', href: '/demos/hypermedia' },
		{ label: 'Process runtime', href: '/demos/process' },
		{ label: 'HTMX form', href: '/demos/htmx-form' },
		{ label: 'Numeric text', href: '/demos/numeric-text' },
	],
	footer: {
		links: [
			{ label: 'Docs', href: 'https://aerojs.mintlify.app' },
			{ label: 'GitHub', href: 'https://github.com/jamiewilson/aero' },
			{ label: 'npm', href: 'https://www.npmjs.com/package/@aero-js/core' },
		],
	},
}
