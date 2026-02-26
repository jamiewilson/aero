---
published: true
title: Props
subtitle: Pass and receive data in components with attributes and data-props.
---

Aero’s props system lets you pass data into components and layouts via attributes or `data-props`, and read it in build scripts from `aero.props` (or `Aero.props`).

## Core concept

All props are read from **aero.props** (or **Aero.props**) in `<script is:build>`. Destructure what you need.

## How attribute values work

- **Normal attributes** are string literals unless you wrap the value in `{ ... }`. Use `{ expression }` for booleans, numbers, or computed values.
- **Directives** (`if`, `else-if`, `else`, `data-each`) need brace-wrapped expressions, e.g. `if="{ condition }"`, `data-each="{ item in items }"`. Unbraced values are invalid.
- **data-props:** `data-props="{ ...data }"` spreads the object’s keys as props. `data-props="{ data }"` passes the object as one prop named `data`. `data-props` with no value spreads a local variable named `props`. Without braces, non-strings become strings and can cause bugs.

## Passing props

**1. String literals**

```html
<my-component title="Hello" count="42" />
```

**2. Expressions**

Use `{ }` for JavaScript expressions:

```html
<my-component title="{ site.meta.title }" count="{ 2 * 21 }" />
```

Compose strings with inline expressions:

```html
<my-component title="Slug: { Aero.params.slug }" />
```

Use double braces to output literal `{` and `}` in strings: `title="{{ slug }} + { Aero.params.slug }"`.

**3. Spread with data-props**

```html
<script is:build>
	const myProps = { title: 'Hello', count: 42 }
</script>
<my-component data-props="{ ...myProps }" />
```

The value must be a brace-wrapped expression (e.g. `data-props="{ ...myProps }"`, not `data-props="myProps"`).

**4. Inline object**

```html
<my-component data-props="{ title: 'Hello', count: 42 }" />
<my-component data-props="{ title: site.meta.title.toUpperCase(), count: 2 * 21 }" />
```

**5. Shorthand (spread local props)**

Use `data-props` with no value to spread a variable named `props` in scope:

```html
<script is:build>
	const props = { title: 'Hello', count: 42 }
</script>
<my-component data-props />
```

**6. Mixed**

```html
<my-component data-props="{ ...baseProps }" extra="value" override="{ computed }" />
```

## Receiving props

Destructure from `aero.props` (or `Aero.props`):

```html
<script is:build>
	const { title, subtitle } = aero.props
</script>

<header>
	<h1>{ title }</h1>
	<p>{ subtitle }</p>
</header>
```

With defaults:

```html
<script is:build>
	const { title = 'Default Title', subtitle } = aero.props
</script>
```

With fallbacks to site data:

```html
<script is:build>
	const { title, description } = aero.props
</script>
<meta property="og:title" content="{ title || site.meta.title }" />
<meta property="og:description" content="{ description || site.meta.description }" />
```

## Available globals

Inside `<script is:build>` you have:

- **aero.props** (or **Aero.props**) — Props passed to this component
- **Aero.request** — Current request object
- **Aero.url** — Current page URL
- **Aero.params** — Route params for dynamic routes
- **site** — Global site data (from your content module, e.g. `content/site.ts` or `@content/site`)
- **slots** — Named and default slot content
- **renderComponent** — Function to render child components

**Dev vs static:** In dev or API runtime, `Aero.request` is the real request and `Aero.url` / `Aero.params` reflect the current route. In a static build, the request is synthetic (headers may be missing), and `Aero.url` / `Aero.params` are set per generated page. Use them for canonical links and route-based content.

## Examples

**Simple component** (e.g. `client/components/greeting.html`):

```html
<script is:build>
	const { name } = aero.props
</script>
<h1>Hello, { name }!</h1>
```

Usage: `<greeting-component name="World" />`

**Computed props** (e.g. in `client/pages/index.html`):

```html
<script is:build>
	import header from '@components/header'
	const headerProps = {
		title: site.home.title,
		subtitle: site.home.subtitle.toUpperCase(),
	}
</script>
<header-component data-props="{ ...headerProps }" />
```

**Mixed props:**

```html
<my-component
	data-props="{ title: site.meta.title, count: 42 }"
	extra="static value"
	computed="{ someExpression }" />
```
