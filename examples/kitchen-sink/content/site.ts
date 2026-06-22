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
		cta: 'Send POST Request',
	},
	about: {
		title: 'About Aero',
		subtitle: 'Lorem ipsum dolor sit amet consectetur adipisicing elit.',
	},
	demos: [
		{ label: 'Counter', href: '/demos/counter' },
		{ label: 'Hypermedia', href: '/demos/hypermedia' },
	],
	footer: {
		links: [
			{ label: 'Home', path: '/' },
			{ label: 'About', path: '/about' },
			{ label: 'Demos', path: '/demos' },
			{ label: 'Docs', path: '/docs' },
		],
	},
}
