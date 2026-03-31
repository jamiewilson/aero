import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
	runtimeConfig: {
		appName: 'Aero Kitchen Sink',
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
			options: { name: 'kitchen-sink' },
		},
	},
	devDatabase: {
		default: {
			connector: 'sqlite',
			options: { name: 'kitchen-sink-dev' },
		},
	},
	plugins: ['./plugins/runtime.ts'],
	tasks: {
		'cache:warm': {
			handler: './tasks/cache/warm.ts',
			description: 'Warm the kitchen sink cache endpoint',
		},
	},
	routeRules: {
		'/health': {
			headers: {
				'cache-control': 'no-store',
			},
		},
		'/api/cache/**': { swr: 60 },
	},
})
