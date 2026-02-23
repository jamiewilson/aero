# @aero-ssg/content

Content collections for Aero: load Markdown (and other files) with frontmatter, validate with Zod, and render to HTML. Powers the `aero:content` virtual module and optional content plugin.

## Exports

| Export | Description |
|--------|-------------|
| `@aero-ssg/content` | `defineCollection`, `defineConfig`, `render`; types `ContentDocument`, `ContentMeta`, `ContentCollectionConfig`, `ContentConfig`. |
| `@aero-ssg/content/vite` | `aeroContent(options?)` Vite plugin. |
| `@aero-ssg/content/markdown` | Markdown/remark utilities (used internally). |
| `@aero-ssg/content/render` | `render(doc)` for markdown-to-HTML. |
| `@aero-ssg/content/types` | TypeScript types. |

## Usage in apps

Enable content in `aero.config.ts` (`content: true` or `content: { config: 'content.config.ts' }`), then define collections in **content.config.ts** and import from `aero:content` in templates.

**content.config.ts**

```ts
import { defineConfig, defineCollection } from '@aero-ssg/content'
import { z } from 'zod'

const docs = defineCollection({
	name: 'docs',
	directory: 'content/docs',
	include: '**/*.md',
	schema: z.object({ title: z.string(), published: z.boolean().optional() }),
	transform: async (doc) => ({ ...doc, data: { ...doc.data, slug: doc._meta.slug } }),
})

export default defineConfig({ collections: [docs] })
```

**In a page (e.g. getStaticPaths + render)**

```html
<script is:build>
	import { getCollection, render } from 'aero:content'

	export async function getStaticPaths() {
		const docs = await getCollection('docs')
		return docs.map((doc) => ({ params: { slug: doc._meta.slug }, props: doc }))
	}

	const doc = aero.props
	const { html } = await render(doc)
</script>
<article data-each="{ doc in [doc] }">
	<h1>{ doc.data.title }</h1>
	<div>{ html }</div>
</article>
```

## API (from `aero:content`)

- **getCollection(name, filterFn?)** — Returns a promise of documents for the named collection. In production, only documents with `data.published === true` are returned unless overridden. Optional `filterFn(doc)` can filter further.
- **render(doc)** — Renders a content document’s markdown body to HTML. Returns `{ html: string }`. Use with a document from `getCollection` or props.

## Content document shape

Each document has:

- **id** — Collection-relative path without extension.
- **data** — Validated frontmatter (from schema).
- **body** — Raw markdown (after frontmatter).
- **_meta** — `{ path, slug, filename, extension }`.

## Vite plugin

`aeroContent(options?)` resolves the virtual module `aero:content` (and `aero:content/...`) with serialized collections, `getCollection`, and `render`. It loads `content.config.ts` at config resolve/build start and watches collection directories for HMR. Options: `config` (path to config file, default `content.config.ts`).

## File structure

- `src/loader.ts` — Load collections, serialize to virtual module source.
- `src/markdown.ts` — Parse Markdown and frontmatter (gray-matter, remark).
- `src/render.ts` — Lazy markdown-to-HTML (remark).
- `src/types.ts` — `defineCollection`, `defineConfig`, types.
- `src/vite.ts` — Vite plugin.

## Tests

Vitest in `packages/content`: loader, markdown, render, Vite plugin. Run from repo root: `pnpm test`.
