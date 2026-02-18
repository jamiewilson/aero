import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		pool: 'forks',
		maxWorkers: 1,
		fileParallelism: false,
		teardownTimeout: 2000,
	},
})
