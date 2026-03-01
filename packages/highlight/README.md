# @aerobuilt/highlight

Shared Shiki syntax highlighting utility for the Aero framework.

Provides composable, reusable Shiki integration across the Aero ecosystem:

- **Markdown code blocks** via `@aerobuilt/content` (opt-in)
- **Custom usage** in templates or CLI tools (direct import)

## Installation

```bash
pnpm add @aerobuilt/highlight
```

## Usage

### With @aerobuilt/content (Markdown Highlighting)

When using `@aerobuilt/content`, enable Shiki highlighting by adding a `highlight.shiki` config to your `content.config.ts`:

````typescript
// content.config.ts
import { defineCollection, defineConfig } from '@aerobuilt/content'
import { transformerDataLang } from '@aerobuilt/highlight'
import { transformerNotationHighlight, transformerNotationFocus } from '@shikijs/transformers'
import { z } from 'zod'

const docs = defineCollection({
	name: 'docs',
	directory: 'content/docs',
	schema: z.object({
		title: z.string(),
		published: z.boolean().default(false),
	}),
})

export default defineConfig({
	collections: [docs],
	highlight: {
		shiki: {
			themes: { light: 'github-light', dark: 'github-dark' },
			langs: ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'bash'],
			transformers: [
				transformerDataLang(), // Adds data-lang="..." on <pre>
				transformerNotationHighlight(), // Highlight lines: ```js {1-3}
				transformerNotationFocus(), // Focus lines: ```js /focus/
			],
		},
	},
})
````

Now all fenced code blocks in your markdown files will be automatically highlighted:

````markdown
```js
const greeting = 'Hello, Shiki!'
console.log(greeting)
```
````

Becomes:

```html
<pre class="shiki shiki-themes github-light github-dark" style="...">
  <code>
    <span class="line"><span style="...">const</span> <span style="...">greeting</span> ...</span>
    <!-- highlighted tokens -->
  </code>
</pre>
```

**Backward Compatibility**: Projects without a `highlight` config in `content.config.ts` continue to render plain `<pre><code>` blocks (unchanged behavior).

### Standalone Usage (Direct Import)

Use `@aerobuilt/highlight` directly for one-off highlighting in any context:

```typescript
import { highlight, transformerDataLang } from '@aerobuilt/highlight'

const html = await highlight('const x = 1', 'js', {
	themes: { light: 'github-light', dark: 'github-dark' },
	transformers: [transformerDataLang()],
})

console.log(html)
// => <pre class="shiki ..." data-lang="js"><code>...</code></pre>
```

### Single Theme Mode

Use `theme` instead of `themes` for single-theme output:

```typescript
const html = await highlight('const x = 1', 'js', {
	theme: 'nord',
})
```

### Caching & Performance

The highlighter is cached at the module level and reused across renders for performance:

```typescript
import { getHighlighter } from '@aerobuilt/highlight'

const config = {
	theme: 'github-light',
	langs: ['js', 'ts'],
}

// First call initializes and caches the highlighter
const h1 = await getHighlighter(config)

// Subsequent calls with same config return the cached instance
const h2 = await getHighlighter(config)
console.log(h1 === h2) // true — same instance
```

## API

### `highlight(code, language, config): Promise<string>`

Highlight a code string and return highlighted HTML.

**Parameters:**

- `code` - Source code to highlight
- `language` - Language ID (e.g., `'js'`, `'python'`)
- `config` - Shiki configuration object

**Returns:** Promise resolving to highlighted HTML string

### `getHighlighter(config): Promise<Highlighter>`

Get or create a cached Shiki highlighter instance. The highlighter is cached at the module level and reused across calls with the same config.

**Parameters:**

- `config` - Shiki configuration object

**Returns:** Promise resolving to a Shiki highlighter instance

### `resetHighlighter(): void`

Clear the cached highlighter. Useful for testing to ensure a fresh instance between tests.

## Configuration

The `ShikiConfig` type wraps Shiki's standard options with full `BundledTheme` and `BundledLanguage` autocomplete.

```typescript
import type { ShikiConfig } from '@aerobuilt/highlight'

// Single theme
const single: ShikiConfig = {
	theme: 'github-light',
	langs: ['js', 'ts', 'html', 'css'],
}

// Multiple themes (light/dark or more)
const dual: ShikiConfig = {
	themes: {
		light: 'github-light',
		dark: 'github-dark',
	},
	// Optional: control which theme gets inline color
	defaultColor: 'light', // 'light' | 'dark' | false | 'light-dark()'
	// Optional: CSS variable prefix for theme colors
	cssVariablePrefix: '--shiki-',
	langs: ['python', 'rust', 'go'],
	transformers: [
		transformerNotationHighlight(), // {1-3}
		transformerNotationFocus(), // /focus/
	],
}
```

### Available Themes

See [Shiki Themes](https://shiki.style/themes) for the full list. Popular options:

- `github-light` / `github-dark`
- `nord` / `nord`
- `vitesse-light` / `vitesse-dark`
- `dracula` / `dracula`

### Available Languages

See [Shiki Languages](https://shiki.style/languages) for the full list. Common IDs:

- `js`, `ts`, `jsx`, `tsx` (JavaScript/TypeScript)
- `html`, `css`, `json`
- `python`, `rust`, `go`
- `bash`, `sh`, `zsh`
- `yaml`, `toml`, `xml`
- ...and 100+ more

### Transformers

Transformers post-process highlighted code to add features like line highlighting, line numbers, and diffs.

```typescript
import { transformerDataLang } from '@aerobuilt/highlight'
import {
	transformerNotationHighlight,
	transformerNotationFocus,
	transformerRenderWhitespace,
	transformerLineNumbers,
} from '@shikijs/transformers'

const config = {
	theme: 'github-light',
	transformers: [
		transformerDataLang(), // Adds data-lang="..." on <pre>
		transformerNotationHighlight(), // Highlight lines: [!code highlight]
		transformerNotationFocus(), // Focus code: [!code focus]
		transformerRenderWhitespace(), // Render whitespace
		transformerLineNumbers(), // Add line numbers
	],
}
```

`transformerDataLang()` uses the raw requested language token (including aliases), so a fenced block tagged as `my-js` emits `data-lang="my-js"`.

See [Shiki Transformers](https://shiki.style/guide/transformers) for all available transformers and usage.

## Styling

Shiki generates semantic HTML with inline styles and CSS classes. The framework does **not** inject CSS — you control styling in your own stylesheets.

**Recommended user stylesheet** (e.g., `src/assets/styles/syntax.css`):

```css
/* Light theme (default) */
.shiki {
	background-color: #f6f8fa;
	color: #24292e;
	overflow-x: auto;
	padding: 1rem;
	border-radius: 0.375rem;
	font-family: 'Menlo', 'Monaco', monospace;
	font-size: 0.875rem;
	line-height: 1.5;
	margin: 1rem 0;
}

/* Dark theme (when root has .dark class) */
.dark .shiki {
	background-color: #0d1117;
	color: #c9d1d9;
}
```

Import in your layout:

```html
<html :class="{ dark: isDarkMode }">
	<head>
		<link rel="stylesheet" href="@styles/syntax.css" />
	</head>
	<!-- ... -->
</html>
```

## Examples

### Markdown with Transformers

In your `content.config.ts`:

```typescript
highlight: {
	shiki: {
		themes: { light: 'github-light', dark: 'github-dark' },
		transformers: [transformerNotationHighlight()],
	},
},
```

In your markdown:

````markdown
```js
const x = 1 // [!code highlight]
const y = 2
```
````

### Custom Component in Templates

```html
<!-- src/components/code-block.html -->
<script is:build>
	import { highlight } from '@aerobuilt/highlight'

	const { code, language = 'js' } = aero.props

	const html = await highlight(code, language, {
		themes: { light: 'github-light', dark: 'github-dark' },
	})
</script>

<pre class="code-block">
	{ html }
</pre>

<style>
	.code-block :global(.shiki) {
		padding: 1rem;
		border-radius: 0.375rem;
	}
</style>
```

## License

MIT
