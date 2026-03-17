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
}
