import { defineCollection, defineConfig } from '@aero-js/content'
import { customTheme } from './lib/custom-theme'
import { z } from 'zod'

const docs = defineCollection({
	name: 'docs',
	directory: 'content/docs',
	include: '**/*.md',
	schema: z.object({
		published: z.boolean().default(false),
		title: z.string(),
		subtitle: z.string(),
	}),
})

export default defineConfig({
	collections: [docs],
	markdown: {
		rehypePlugins: [customTheme()],
	},
})
