# Single-File Markdown Import

You can import individual `.md` files from the `content/` directory and render them with `render()`, without using collections.

## Minimal Usage

No `content.config.ts` is required for the basic case:

```html
<script is:build>
	import { render } from 'aero:content'
	import overview from '@content/overview.md'
	const { html } = await render(overview)
</script>

<article class="prose">
	<h1>{ overview.data.title }</h1>
	<p>{ overview.data.subtitle }</p>
	{ html }
</article>
```

Files must live under the project's `content/` directory. The `@content` alias resolves to `content/`.

## Content Document Shape

Each imported `.md` file returns a `ContentDocument`:

- **`id`** – Path relative to `content/` (e.g. `docs/overview`)
- **`data`** – Parsed frontmatter
- **`body`** – Raw markdown after the frontmatter
- **`_meta`** – `{ path, slug, filename, extension }`

## Schema Matching

When `content.config.ts` exists and the file is inside a collection's `directory` + `include`:

- The collection's schema is used to validate frontmatter
- Any `transform` on the collection is applied

When the file is outside all collections (or there is no config):

- Frontmatter is passed through without validation
- No transform is applied

## Markdown Plugins

To use remark/rehype plugins (e.g. GFM, Shiki), add `content.config.ts` with a `markdown` section:

```ts
import { defineConfig } from '@aero-js/content'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'

export default defineConfig({
	markdown: {
		remarkPlugins: [remarkGfm],
		rehypePlugins: [rehypeSlug],
	},
})
```

The same markdown pipeline applies to both collection documents and single-file imports.
