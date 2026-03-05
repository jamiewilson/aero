# Rehype Integration

`@aerobuilt/content` configures the markdown pipeline via `markdown.rehypePlugins` in `content.config.ts`. There is no separate `highlight` config key — you add a Shiki rehype plugin yourself. This document explains the pipeline and the two ways to plug in Shiki.

## The Rehype Pipeline

The content package always uses a rehype-based pipeline:

```
remark → [remarkPlugins] → remark-rehype → [rehypePlugins] → rehype-stringify
```

| Step               | Role                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `remark`           | Parses markdown into mdast                                           |
| `remark-rehype`    | Converts mdast to hast (HTML AST)                                    |
| `[rehypePlugins]`  | User-supplied plugins (e.g. `@shikijs/rehype`, `rehype-pretty-code`) |
| `rehype-stringify` | Serializes hast to HTML                                              |

Without any rehype plugins, fenced code blocks render as plain `<pre><code>`. To get syntax highlighting, add `@shikijs/rehype` (or another Shiki-based plugin) to `markdown.rehypePlugins`.

## Two Shiki Rehype Plugins

Shiki offers two rehype plugins:

1. **`rehypeShiki`** (from `@shikijs/rehype`) — Creates its own highlighter internally. Simple: pass the plugin and options (themes, transformers, etc.) in `rehypePlugins`. This is what most projects use (see the [highlight README](../README.md)).
2. **`rehypeShikiFromHighlighter`** (from `@shikijs/rehype/core`) — Accepts a pre-created highlighter instance. Use this with `getHighlighter()` from `@aerobuilt/highlight` when you want a **cached highlighter** shared across the pipeline, which can improve dev and build performance by reusing the same Shiki instance.

## Configuring via content.config.ts

You pass the plugin (and options) in `markdown.rehypePlugins`:

```ts
// content.config.ts
import rehypeShiki from '@shikijs/rehype'
import { preDataLangTransformer } from '@aerobuilt/highlight'

export default defineConfig({
	collections: [docs],
	markdown: {
		rehypePlugins: [
			[
				rehypeShiki,
				{
					themes: { light: 'github-light', dark: 'github-dark' },
					defaultColor: 'light-dark()',
					transformers: [preDataLangTransformer()],
				},
			],
		],
	},
})
```

Options for `rehypeShiki` (and for `rehypeShikiFromHighlighter` when using the second argument) include: `themes` / `theme`, `defaultColor`, `cssVariablePrefix`, `transformers`, `inline` (e.g. `'tailing-curly-colon'`), `defaultLanguage`, and others — see [Shiki rehype](https://shiki.style/packages/rehype).

## See Also

- [Shiki rehype integration](https://shiki.style/packages/rehype)
- [`@aerobuilt/highlight` README](../README.md)
