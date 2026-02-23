---
published: true
title: Props Guide
subtitle: Learn how to use the flexible, Astro-inspired props system in TBD framework for intuitive component composition.
date: 2026-04-15
---

The Aero framework provides a flexible, Astro-inspired props system that makes component composition intuitive and powerful.

## Core Concept

**All props are accessed via `Aero.props`** - this is the single source of truth. Components explicitly destructure what they need from `Aero.props`.

## Passing Props to Components

There are **four ways** to pass props to components:

### 1. Individual Attributes (String Literals)

```html
<my-component title="Hello" count="42" />
```

### 2. Individual Attributes (Expressions)

Use `{ }` to evaluate JavaScript expressions:

```html
<my-component title="{ site.meta.title }" count="{ 2 * 21 }" />
```

You can also compose strings with inline expressions:

```html
<my-component title="Slug: { Aero.params.slug }" />
```

If `Aero.params.slug === 'intro'`, `title` becomes `Slug: intro`.

To render literal braces in composed strings, use double braces:

```html
<my-component title="{{ slug }} + { Aero.params.slug }" />
```

If `Aero.params.slug === 'intro'`, `title` becomes `{ slug } + intro`.

### 3. Spread Syntax

Spread an existing object using `data-props` or `props`:

```html
<script is:build>
	const myProps = { title: 'Hello', count: 42 }
</script>
<my-component data-props="{ ...myProps }" />
<my-component props="{ ...myProps }" />
```

`data-props`/`props` values must be brace-wrapped expressions. For example,
`data-props="myProps"` is invalid and should be written as
`data-props="{ ...myProps }"`.

### 4. Inline Object Literals

Define props inline with `data-props` or `props`:

```html
<my-component data-props="{ title: 'Hello', count: 42 }" />
<my-component props="{ title: 'Hello', count: 42 }" />
```

You can also use expressions:

```html
<my-component props="{ title: site.meta.title.toUpperCase(), count: 2 * 21 }" />
```

### 5. Shorthand (JavaScript-style)

Like JavaScript's object shorthand (`{ props }` means `{ props: props }`), you can use `data-props` or `props` with no value to spread a `props` variable:

```html
<script is:build>
	const props = { title: 'Hello', count: 42 }
</script>
<my-component props />
<!-- Equivalent to: data-props="{ ...props }" -->
```

This only works if you have a variable named `props` in scope.

### 6. Mixed Approach

Combine `data-props` with individual attributes:

```html
<my-component data-props="{ ...baseProps }" extra="value" override="{ computed }" />
```

## Receiving Props in Components

Components access props by destructuring `Aero.props`:

```html
<script is:build>
	// Destructure the props you need
	const { title, subtitle } = Aero.props
</script>

<header>
	<h1>{ title }</h1>
	<p>{ subtitle }</p>
</header>
```

### With Defaults

```html
<script is:build>
	const { title = 'Default Title', subtitle } = Aero.props
</script>
```

### With Fallbacks to Site Data

```html
<script is:build>
	const { title, description } = Aero.props
</script>

<meta property="og:title" content="{ title || site.meta.title }" />
<meta property="og:description" content="{ description || site.meta.description }" />
```

## Available Globals

Inside `on:build` scripts, you have access to:

- **`Aero.props`** - Props passed to this component
- **`Aero.request`** - Current request object
- **`Aero.url`** - Current page URL
- **`Aero.params`** - Route params for dynamic routes
- **`site`** - Global site configuration (from your content module, e.g. `client/content/site.ts`, imported via `@content/site`)
- **`slots`** - Named and default slot content
- **`renderComponent`** - Function to render child components

## Request/URL/Params Examples

### Dev vs Static behavior

| Global         | Dev server / API runtime                               | Static build (`pnpm build` HTML output)                    |
| -------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| `Aero.request` | Real incoming request (method + forwarded headers)     | Synthetic request; request-specific headers may be missing |
| `Aero.url`     | URL for the current incoming route                     | URL derived from the generated page route                  |
| `Aero.params`  | Populated for dynamic route files (e.g. `[slug].html`) | Only populated when rendering dynamic route pages          |

### Read request metadata

```html
<script is:build>
	const userAgent = Aero.request.headers.get('user-agent') || 'unavailable'
</script>

<p>User agent: { userAgent }</p>
```

In local dev/server rendering, request headers are forwarded from the incoming request.
In static builds, request-specific headers may be unavailable.

### Build canonical links from the current URL

```html
<script is:build>
	const canonical = new URL(Aero.url.pathname, Aero.site).toString()
</script>

<link rel="canonical" href="{ canonical }" />
```

### Use dynamic route params

In a dynamic route file such as `client/pages/docs/[slug].html`:

```html
<script is:build>
	const slug = Aero.params.slug || 'index'
</script>

<h1>Docs: { slug }</h1>
```

## Examples

### Simple Component

```html
<!-- components/greeting.html -->
<script is:build>
	const { name } = Aero.props
</script>

<h1>Hello, { name }!</h1>
```

Usage:

```html
<greeting-component name="World" />
```

### Component with Computed Props

```html
<!-- pages/index.html -->
<script is:build>
	import header from '@components/header'

	const headerProps = {
		title: site.home.title,
		subtitle: site.home.subtitle.toUpperCase(),
	}
</script>

<header-component data-props="{ ...headerProps }" />
```

### Component with Mixed Props

```html
<my-component
	data-props="{ title: site.meta.title, count: 42 }"
	extra="static value"
	computed="{ someExpression }" />
```
