# Props System Guide

The TBD framework provides a flexible, Astro-inspired props system that makes component composition intuitive and powerful.

## Core Concept

**All props are accessed via `tbd.props`** - this is the single source of truth. Components explicitly destructure what they need from `tbd.props`.

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

### 3. Spread Syntax

Spread an existing object using `data-props` or `props`:

```html
<script on:build>
	const myProps = { title: 'Hello', count: 42 }
</script>
<my-component data-props="{ ...myProps }" />
<my-component props="{ ...myProps }" />
```

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
<script on:build>
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

Components access props by destructuring `tbd.props`:

```html
<script on:build>
	// Destructure the props you need
	const { title, subtitle } = tbd.props
</script>

<header>
	<h1>{ title }</h1>
	<p>{ subtitle }</p>
</header>
```

### With Defaults

```html
<script on:build>
	const { title = 'Default Title', subtitle } = tbd.props
</script>
```

### With Fallbacks to Site Data

```html
<script on:build>
	const { title, description } = tbd.props
</script>

<meta property="og:title" content="{ title || site.meta.title }" />
<meta property="og:description" content="{ description || site.meta.description }" />
```

## Available Globals

Inside `on:build` scripts, you have access to:

- **`tbd.props`** - Props passed to this component
- **`site`** - Global site configuration (from `data/site.ts`)
- **`slots`** - Named and default slot content
- **`renderComponent`** - Function to render child components

## Examples

### Simple Component

```html
<!-- components/greeting.html -->
<script on:build>
	const { name } = tbd.props
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
<script on:build>
	import header from '@/components/header'

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
