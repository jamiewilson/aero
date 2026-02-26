# Content API

Aero’s content layer (`@aerobuilt/content`) provides typed content collections, Markdown rendering, and integration with file-based routing.

## Content Schema & Definitions

Declare your content schema in `aero.content.ts` in your project root (or as configured). The API uses Zod so you get typed data in templates without custom Vite transformers.

```typescript
import { defineCollection, z } from 'aerobuilt/content'

export const docs = defineCollection({
	name: 'docs',
	directory: 'client/content/docs',
	schema: z.object({
		title: z.string(),
		date: z.date(),
	}),
})
```

## `getCollection()`

The global `getCollection('name')` method is the modern approach to iterating and fetching data objects statically inside routing handlers.

Instead of relying on clunky static `allDocs` exports, you fetch collections natively on demand:

```html
<!-- client/pages/docs/index.html -->
<script is:build>
	import { getCollection } from 'aero:content'

	// Fetches validated items directly from the aero.content.ts configuration
	const allDocs = await getCollection('docs')
	allDocs.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
</script>

<ul>
	<li data-each="{ doc in allDocs }">
		<a href="/docs/{ doc.id }">{ doc.data.title }</a>
	</li>
</ul>
```

## Lazy `render()` Generation

Previously, Markdown bodies were parsed, transpiled to HTML, and embedded immediately when the collection was fetched. This bloats memory usages exponentially on routing list pages over time. Now, HTML generation is handled lazily to save computing thresholds!

```html
<!-- client/pages/docs/[slug].html -->
<script is:build>
	import { render } from 'aero:content'

	const doc = Aero.props;
	// Execution converts AST to raw HTML *on demand*
	// It natively returns `{ html: '' }` without crashing if given empty inputs
	const { html } = await render(doc)
</script>

<h1>{ doc.data.title }</h1>
<article>{ html }</article>
```

## Props routing in `getStaticPaths`

Dynamic route mapping usually happens through `getStaticPaths()`. To simplify rendering singletons natively across files without repetitive code polling, `getStaticPaths` lets you emit `{ params, props }`.

When defining paths, pass the entire resource object locally into `props`:

```javascript
import { getCollection } from 'aero:content'

export async function getStaticPaths() {
	const docs = await getCollection('docs')

	// Provide the slug param for the builder URL,
	// while attaching the complete reference as the data property
	return docs.map(doc => ({
		params: { slug: doc.id },
		props: doc,
	}))
}
```

The route dynamically picks up the data and surfaces it via `Aero.props` immediately logic-free!

```html
<script is:build>
	import { render } from 'aero:content'

	// The doc object provided mapped across getStaticPaths seamlessly
	const doc = Aero.props
	const { html } = await render(doc)
</script>
```
