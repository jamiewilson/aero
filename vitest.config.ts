import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		projects: [
			'packages/*',
			{
				test: {
					name: 'scripts',
					include: ['scripts/**/*.test.{ts,js}'],
				},
			},
		],
	},
})
