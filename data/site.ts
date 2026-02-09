import { ThemeMode } from '@data/theme'

export default {
	meta: {
		title: 'Site Meta Title',
		description: 'Site Meta Description',
		url: 'https://tbd.dev',
		ogImage: '/og-image.png',
	},
	theme: {
		options: Object.values(ThemeMode),
		default: ThemeMode.System,
	},
	home: {
		title: 'Welcome to Aero',
		subtitle:
			'A small web framework that gives you a better developer experience for mostly-vanilla HTML projects.',
		cta: 'Send POST Request',
	},
	about: {
		title: 'About TBD',
		subtitle: 'Learn more our philosophy and goals.',
	},
	footer: {
		links: [
			{ label: 'Home', path: '/' },
			{ label: 'About', path: '/about' },
			{ label: 'Docs', path: '/docs' },
		],
	},
}
