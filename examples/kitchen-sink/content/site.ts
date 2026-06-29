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
		title: 'Welcome to Aero',
		subtitle:
			'A small web framework that gives you a better developer experience for mostly-vanilla HTML projects.',
	},
	htmxForm: {
		title: 'HTMX form',
		subtitle: 'Alpine x-model with an HTMX POST and toast fragment.',
		cta: 'Send POST Request',
	},
	demos: [
		{ label: 'Scripts', href: '/demos/scripts' },
		{ label: 'Image imports', href: '/demos/images' },
		{ label: 'Counter (live props)', href: '/demos/counter' },
		{ label: 'Conditionals', href: '/demos/conditionals' },
		{ label: 'Keyed list', href: '/demos/keyed-list' },
		{ label: 'Form model', href: '/demos/form-model' },
		{ label: 'Bindings', href: '/demos/bindings' },
		{ label: 'Adopt runtime', href: '/demos/adopt' },
		{ label: 'Hypermedia', href: '/demos/hypermedia' },
		{ label: 'HTMX form', href: '/demos/htmx-form' },
	],
	footer: {
		links: [
			{ label: 'Home', path: '/' },
			{ label: 'Demos', path: '/demos' },
			{ label: 'Docs', path: '/docs' },
		],
	},
}
