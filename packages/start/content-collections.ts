import { defineCollection, defineConfig } from '@content-collections/core'
import { compileMarkdown } from '@content-collections/markdown'
import { z } from 'zod'

const docs = defineCollection({
	name: 'docs',
	directory: 'src/content/docs',
	include: '**/*.md',
	schema: z.object({
		title: z.string(),
		subtitle: z.string().optional(),
		date: z.string(),
		content: z.string(),
	}),
	transform: async (document, context) => {
		const html = await compileMarkdown(context, document)
		const rawPath = document._meta?.path || ''
		const slug = rawPath.split('/').pop()?.replace(/\.md$/, '') || ''

		return {
			...document,
			html,
			slug,
		}
	},
})

export default defineConfig({
	content: [docs],
})
