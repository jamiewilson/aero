import { ThemeMode } from '~/data/theme'

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
		title: 'TBD',
		subtitle: `A mostly-native web framework.`,
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
