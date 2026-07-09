import { z } from 'zod'
import { defineCollection, defineConfig } from '@aero-js/content'
import customTheme from '@shared/rehype/custom-theme'
import preNotProse from '@shared/rehype/pre-not-prose'

const rehypePlugins = [customTheme(), preNotProse]

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
	markdown: { rehypePlugins },
})
