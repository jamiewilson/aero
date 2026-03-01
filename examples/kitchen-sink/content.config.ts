import { defineCollection, defineConfig } from 'aerobuilt/content'
import { transformerDataLang } from '@aerobuilt/highlight'
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
	highlight: {
		shiki: {
			themes: {
				light: 'catppuccin-latte',
				dark: 'catppuccin-mocha',
			},
			defaultColor: 'light-dark()',
			transformers: [transformerDataLang()],
		},
	},
})
