import { defineCollection, defineConfig } from '@aero-js/content'
import { customShikiTheme } from './lib/shiki-custom-theme.ts'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
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
		remarkPlugins: [remarkGfm],
		rehypePlugins: [rehypeSlug, customShikiTheme()],
	},
})
