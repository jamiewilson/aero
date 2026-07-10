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
		default: ThemeMode.Light,
		storageKey: 'theme',
		attribute: 'data-theme',
	},
	home: {
		title: 'aero',
		subtitle:
			'A static site generator with optional reactivity and full-stack hypermedia-based framework, powered by Vite and Nitro, deployable anywhere.',
	},
	demos: [
		{ label: 'Templating', href: '/demos/templating' },
		{ label: 'Props', href: '/demos/props' },
		{ label: 'Layouts & slots', href: '/demos/layouts-slots' },
		{ label: 'Scripts', href: '/demos/scripts' },
		{ label: 'Image imports', href: '/demos/images' },
		{ label: 'Conditionals', href: '/demos/conditionals' },
		{ label: 'Keyed list', href: '/demos/keyed-list' },
		{ label: 'Iterables', href: '/demos/iterables' },
		{ label: 'Form model', href: '/demos/form-model' },
		{ label: 'Bindings', href: '/demos/bindings' },
		{ label: 'Reactivity', href: '/demos/reactivity' },
		{ label: 'Hypermedia', href: '/demos/hypermedia' },
		{ label: 'Process runtime', href: '/demos/process' },
		{ label: 'HTMX form', href: '/demos/htmx-form' },
		{ label: 'Numeric text', href: '/demos/numeric-text' },
		{ label: 'Snippets', href: '/demos/snippets' },
		{ label: 'Error pages', href: '/demos/error-pages' },
	],
	footer: {
		links: [
			{ label: 'docs', href: 'https://aerojs.mintlify.app' },
			{ label: 'github', href: 'https://github.com/jamiewilson/aero' },
			{ label: 'npm', href: 'https://www.npmjs.com/package/@aero-js/core' },
		],
	},
}
