import { defineCollection, defineConfig } from '@aero-ssg/content'
import { z } from 'zod'

const docs = defineCollection({
	name: 'docs',
	directory: 'content/docs',
	include: '**/*.md',
	schema: z.object({
		published: z.boolean().default(false),
		title: z.string(),
		subtitle: z.string().optional(),
		date: z.date(),
	}),
})

export default defineConfig({
	collections: [docs],
})
