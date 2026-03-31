import { defineTask } from 'nitro/task'

export default defineTask({
	meta: {
		name: 'cache:warm',
		description: 'Warm the starter cache endpoint',
	},
	run() {
		return {
			result: {
				warmedAt: new Date().toISOString(),
			},
		}
	},
})
