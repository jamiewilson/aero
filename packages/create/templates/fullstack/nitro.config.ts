import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
	runtimeConfig: {
		appName: 'Aero Fullstack Starter',
	},
	experimental: {
		database: true,
		tasks: true,
	},
	storage: {
		data: {
			driver: 'fs',
			base: './.data/kv',
		},
		cache: {
			driver: 'fs',
			base: './.data/cache',
		},
	},
	devStorage: {
		data: {
			driver: 'fs',
			base: './.data/dev-kv',
		},
		cache: {
			driver: 'fs',
			base: './.data/dev-cache',
		},
	},
	database: {
		default: {
			connector: 'sqlite',
			options: { name: 'app' },
		},
	},
	devDatabase: {
		default: {
			connector: 'sqlite',
			options: { name: 'app-dev' },
		},
	},
	plugins: ['./server/plugins/runtime.ts'],
	tasks: {
		'cache:warm': {
			handler: './server/tasks/cache/warm.ts',
			description: 'Warm the starter cache endpoint',
		},
	},
	serverEntry: './server/entry.ts',
	routeRules: {
		'/health': {
			headers: {
				'cache-control': 'no-store',
			},
		},
		'/api/cache/**': { swr: 60 },
	},
})
