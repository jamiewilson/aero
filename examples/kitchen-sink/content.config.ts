import { defineCollection, defineConfig } from '@aero-js/content'
import { aeroHtmlGrammar as html, preDataLangTransformer } from '@aero-js/highlight'
import rehypeShiki from '@shikijs/rehype'
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
		rehypePlugins: [
			[
				rehypeShiki,
				{
					themes: {
						light: 'github-light',
						dark: 'github-dark-high-contrast',
					},
					defaultColor: 'light-dark()',
					inline: 'tailing-curly-colon',
					langs: ['js', 'ts', 'html', 'css', 'json', 'bash', html],
					transformers: [preDataLangTransformer()],
				},
			],
		],
	},
})
