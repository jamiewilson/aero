export default {
	meta: {
		title: 'Aero Fullstack Starter',
		description: 'Aero with Nitro configured through a root nitro.config.ts.',
		ogImage: '/aero.png',
		icon: {
			svg: '/favicon.svg',
		},
	},
	home: {
		title: 'Aero + Nitro',
		subtitle: 'Static-first pages with Nitro-native APIs and config.',
	},
	about: {
		title: 'About',
		subtitle: 'This starter keeps Nitro native inside an Aero project.',
	},
	footer: {
		links: [
			{ label: 'Home', path: '/' },
			{ label: 'About', path: '/about' },
			{ label: 'Health', path: '/health' },
		],
	},
	api: ['/api/hello', '/api/cache/time', '/api/database/users', '/api/kv/example'],
}
