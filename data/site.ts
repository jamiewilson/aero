import { Theme } from '~/data/theme'

export const site = {
	meta: {
		title: 'TBD',
		description: 'Site Description TBD',
		url: 'https://tbd.dev',
		ogImage: '/og-image.png',
	},
	theme: {
		modes: Object.values(Theme),
		default: Theme.System,
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
