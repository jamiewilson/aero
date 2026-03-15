export default {
	meta: {
		title: 'Minimal Template',
		description: 'Site Meta Description',
		ogImage: '/aero.png',
		icon: {
			ico: '/favicon.ico',
			svg: '/favicon.svg',
			apple: '/apple-touch-icon.png',
		},
	},
	home: {
		title: 'Welcome to Aero',
		subtitle: 'A minimal static site with HTML-first templates.',
	},
	about: {
		title: 'About',
		subtitle: 'A minimal about page.',
	},
	footer: {
		links: [
			{ label: 'Home', path: '/' },
			{ label: 'About', path: '/about' },
		],
	},
}
