import { ThemeMode } from '@content/theme'

export default {
	meta: {
		title: 'Site Meta Title',
		description: 'Site Meta Description',
		url: 'https://aero.dev',
		ogImage: '/og-image.png',
		icon: {
			ico: '/favicon.ico',
			svg: '/favicon.svg',
			apple: '/apple-touch-icon.png',
		},
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
		title: 'About Aero',
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
