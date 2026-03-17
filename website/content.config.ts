import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineCollection, defineConfig } from '@aero-js/content'
import { aeroHtml, addPreDataLang } from '@aero-js/highlight'
import rehypeShiki from '@shikijs/rehype'
import remarkGfm from 'remark-gfm'
import { z } from 'zod'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
		rehypePlugins: [
			[
				rehypeShiki,
				{
					get themes() {
						const { customLightTheme, customDarkTheme } = require(
							path.join(__dirname, 'lib/shiki-themes.ts')
						) as typeof import('./lib/shiki-themes')
						return { light: customLightTheme, dark: customDarkTheme }
					},
					defaultColor: 'light-dark()',
					inline: 'tailing-curly-colon',
					langs: ['js', 'ts', 'html', 'css', 'json', 'bash', aeroHtml],
					transformers: [addPreDataLang()],
				},
			],
		],
	},
})
