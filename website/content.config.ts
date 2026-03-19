import { defineConfig } from '@aero-js/content'
import { customTheme } from './lib/custom-theme'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'

export default defineConfig({
	markdown: {
		remarkPlugins: [remarkGfm],
		rehypePlugins: [rehypeSlug, customTheme()],
	},
})
