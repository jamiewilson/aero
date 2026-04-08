import { defineHandler } from 'nitro/h3'
import { runTask } from 'nitro/task'

export default defineHandler(async () => {
	const { result } = await runTask('cache:warm')
	return { result }
})
