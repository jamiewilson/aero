import { ThemeMode } from '~/data/theme'

export default {
	meta: {
		title: 'TBD',
		description: 'Site Description TBD',
		url: 'https://tbd.dev',
		ogImage: '/og-image.png',
	},
	theme: {
		options: Object.values(ThemeMode),
		default: ThemeMode.System,
	},
	home: {
		title: 'Welcome to TBD',
		subtitle: `A framework that feels like native HTML. Because it is native HTML.`,
		cta: 'Send POST Request',
	},
	about: {
		title: 'About TBD',
		subtitle: 'Learn more our philosophy and goals.',
	},
	footer: {
		links: [
			{ label: 'Home', url: '/' },
			{ label: 'About', url: '/about' },
		],
	},
}
