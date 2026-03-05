# TypeScript with Aero

Aero's ambient types and language server support give you type safety in build scripts, component props, content collections, and template expressions. This guide covers how to use TypeScript effectively with Aero.

## Overview

Inside `<script is:build lang="ts">` blocks you get:

- **`Aero`** — Runtime context (props, slots, request, url, params, site). Use `Aero` (capital A); `aero` is not defined at runtime.
- **`renderComponent`** — Render child components
- **`*.html`** — Import components as modules
- **`aero:content`** — Content collections (`getCollection`, `render`)

The VS Code extension and language server provide IntelliSense, diagnostics, and go-to-definition for these globals. Add `lang="ts"` (or `lang="typescript"`) to script tags so the language server extracts them for TypeScript support; this also enables Prettier and oxfmt to format the content. You can add your own types for props, content globals, and collection entries.

---

## Typing Component Props

`Aero.props` is typed as `Record<string, any>` by default. To get type safety, define an interface and assert or narrow the type when destructuring.

### Inline interface in the component

```html
<!-- client/components/greeting.html -->
<script is:build lang="ts">
	interface GreetingProps {
		name: string
		title?: string
	}

	const { name, title = 'Guest' } = Aero.props as GreetingProps
</script>

<h1>Hello, { name }!</h1>
{ title ? `
<p class="subtitle">{ title }</p>
` : '' }
```

### Shared types file

For components that share prop shapes, define types in a `.ts` file and import them. Add a path alias (e.g. `@project-types/*` → `types/*`) to `tsconfig.json`, or use `types/props` directly (with `baseUrl: "./"`). Avoid `@types/*`—that prefix is reserved for DefinitelyTyped packages.

```typescript
// client/types/props.ts
export interface HeaderProps {
	title: string
	subtitle?: string
}

export interface MetaProps {
	title?: string
	description?: string
	image?: string
}
```

```html
<!-- client/components/header.html -->
<script is:build lang="ts">
	import type { HeaderProps } from 'types/props'

	const { title, subtitle } = Aero.props as HeaderProps
</script>

<header>
	<h1>{ title }</h1>
	{subtitle ? `
	<p>{ subtitle }</p>
	` : ''}
</header>
```

### Typed props when passing

When passing props from a page or parent component, type the object you spread:

```html
<!-- client/pages/index.html -->
<script is:build lang="ts">
	import header from '@components/header'
	import site from '@content/site'
	import type { HeaderProps } from 'types/props'

	const headerProps: HeaderProps = {
		title: site.home.title,
		subtitle: site.home.subtitle,
	}
</script>

<header-component props="{ ...headerProps }" />
```

---

## Typing Content Globals

Content files in `client/content/` (e.g. `site.ts`, `theme.ts`) are exposed as globals (`site`, `theme`) in templates. Type them by exporting typed objects from `.ts` files.

### Typed site data

```typescript
// client/content/site.ts
export interface SiteMeta {
	title: string
	description: string
	ogImage: string
	icon: { ico: string; svg: string; apple: string }
}

export interface SiteHome {
	title: string
	subtitle: string
	cta: string
}

export default {
	meta: {
		title: 'My Site',
		description: '...',
		ogImage: '/og.png',
		icon: {
			ico: '/favicon.ico',
			svg: '/favicon.svg',
			apple: '/apple-touch-icon.png',
		},
	} satisfies SiteMeta,
	home: {
		title: 'Welcome',
		subtitle: '...',
		cta: 'Get Started',
	} satisfies SiteHome,
}
```

In build scripts, `site` is inferred from the default export. For stricter checking, you can add a type assertion or use `satisfies` in the content file (as above).

---

## Typing Content Collections

The `aero:content` module provides `getCollection()` and `render()`. The language server declares `CollectionEntry` with `id`, `data`, and `body`. To type `data` per collection, use Zod schemas in `content.config.ts` and optionally extend the ambient types.

### Schema in content.config.ts

```typescript
// content.config.ts
import { defineConfig, defineCollection } from '@aerobuilt/content'
import { z } from 'zod'

const docsSchema = z.object({
	title: z.string(),
	subtitle: z.string().optional(),
	published: z.number(),
})

export default defineConfig({
	collections: [
		defineCollection({
			name: 'docs',
			directory: 'client/content/docs',
			schema: docsSchema,
		}),
	],
})
```

`getCollection('docs')` returns entries whose `data` is validated against this schema. TypeScript infers the shape from the schema when you use it.

### Typing getStaticPaths and render

```html
<!-- client/pages/docs/[slug].html -->
<script is:build lang="ts">
	import { getCollection, render } from 'aero:content'

	export async function getStaticPaths() {
		const docs = await getCollection('docs')
		return docs.map(doc => ({
			params: { slug: doc.id },
			props: doc,
		}))
	}

	// Aero.props is the doc passed from getStaticPaths
	const doc = Aero.props
	const { html } = await render(doc)
</script>

<h1>{ doc.data.title }</h1>
{subtitle ? `
<p>{ doc.data.subtitle }</p>
` : ''}
<article>{ html }</article>
```

For stronger typing of `doc.data`, you can define an interface and assert:

```html
<script is:build>
	import { getCollection, render } from 'aero:content'

	interface DocData {
		title: string
		subtitle?: string
		published: number
	}

	export async function getStaticPaths() {
		const docs = await getCollection('docs')
		return docs.map(doc => ({
			params: { slug: doc.id },
			props: doc,
		}))
	}

	const doc = Aero.props
	const data = doc.data as DocData
	const { html } = await render(doc)
</script>

<h1>{ data.title }</h1>
```

---

## Ambient Types and env.d.ts

The framework ships ambient declarations in `@aerobuilt/core/env`. Include them so TypeScript knows about `Aero`, `renderComponent`, and `*.html` imports.

### Option 1: tsconfig types

```json
{
	"compilerOptions": {
		"types": ["@aerobuilt/core/env"]
	}
}
```

### Option 2: Triple-slash reference

At the top of a `.ts` file that needs the globals:

```typescript
/// <reference types="@aerobuilt/core/env" />
```

For `.html` build scripts, the VS Code extension and language server inject these declarations automatically. You don't need to add them for template files.

---

## Extending Ambient Types

To add custom globals or refine existing ones, create an `env.d.ts` in your project root:

```typescript
// env.d.ts
/// <reference types="@aerobuilt/core/env" />

// Custom global
declare const MY_CONFIG: {
	apiUrl: string
	featureFlags: Record<string, boolean>
}
```

Ensure this file is included in your `tsconfig.json` (e.g. via `include` or `files`).

---

## Path Aliases and Imports

Path aliases (`@components/*`, `@layouts/*`, `@content/*`, etc.) are resolved by both the build and the language server. Keep `tsconfig.json` `paths` in sync with your `aero.config` or `vite.config` `dirs` so imports and go-to-definition work correctly.

See [Tsconfig path aliases](tsconfig-aliases.md) for details.

---

## Troubleshooting

### IntelliSense not updating when types change

If you edit a shared types file (e.g. `types/props.ts`) and the new definitions don't appear in hover or autocomplete in your templates:

1. **Restart the TypeScript server** — Run `TypeScript: Restart TS Server` from the command palette (Cmd+Shift+P). Volar's virtual file system can cache type resolution; a restart forces a full re-check.
2. **Path aliases** — You can use `@project-types/props` (if configured in tsconfig `paths`) or `types/props` (with `baseUrl: "./"`); both should resolve when the TS server has the correct project context.
3. **Workspace root** — Open the folder that contains your `tsconfig.json` (e.g. `examples/kitchen-sink`) as the workspace root, or ensure it's included in a multi-root workspace.

### Prop validation when using components

Cross-file prop validation is implemented for `props="{ ...varName }"` (spread) and layout attributes. The VS Code extension reports missing required props when you pass a typed object via spread or when a layout passes props to a child component. Limitations: validation only applies when the component uses `Aero.props as SomeProps` with a resolvable interface; attribute-based props (e.g. `title="{ x }"`) are not yet validated. Type safety inside each component's build script (e.g. `Aero.props as MetaProps`) is always available.

---

## Summary

| Area                    | Approach                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| **Component props**     | Define `interface Props { ... }` and use `Aero.props as Props` when destructuring; cross-file validation for `props` spread and layout attributes (with limitations) |
| **Content globals**     | Export typed objects from `content/*.ts`; use `satisfies` for validation                 |
| **Content collections** | Use Zod schema in `content.config.ts`; optionally add `DocData` interface for `doc.data` |
| **Ambient globals**     | Use `@aerobuilt/core/env`; extend via project `env.d.ts`                                 |
| **Path aliases**        | Configure in `tsconfig.json` and keep in sync with Aero `dirs`                           |

The language server provides IntelliSense, diagnostics, and navigation for build scripts. Typing props and content data gives you better autocomplete and catches mistakes at edit time.
