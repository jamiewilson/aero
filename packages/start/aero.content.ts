import { defineCollection, defineConfig } from '@aero-ssg/content'
import { z } from 'zod'

const docs = defineCollection({
	name: 'docs',
	directory: 'client/content/docs',
	include: '**/*.md',
	schema: z.object({
		title: z.string(),
		subtitle: z.string().optional(),
		date: z.date(),
	}),
})

export default defineConfig({
	collections: [docs],
})
