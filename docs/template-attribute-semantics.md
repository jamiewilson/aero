# Template Attribute Semantics

This document defines how Aero evaluates attribute values in templates.

## Core Rule

- **Normal attributes** are treated as **string literals** by default.
- Wrap values in `{ ... }` when you want Aero to evaluate a JavaScript expression.

## Component Props (Normal Attributes)

### String literal (no braces)

```html
<logo-component label="props.showLogo" />
```

This passes:

```ts
{
	label: 'props.showLogo'
}
```

### Expression (with braces)

```html
<logo-component showLogo="{ props.showLogo }" />
```

If `props.showLogo === true`, this passes:

```ts
{
	showLogo: true
}
```

### Composed strings with interpolation

Component props also support mixed text + expression interpolation:

```html
<logo-component title="Slug: { Aero.params.slug }" />
```

If `Aero.params.slug === 'intro'`, this passes:

```ts
{
	title: 'Slug: intro'
}
```

### Literal braces in composed strings

Use double braces to emit literal `{` and `}` in quoted prop strings:

```html
<logo-component title="{{ slug }} + { Aero.params.slug }" />
```

If `Aero.params.slug === 'intro'`, this passes:

```ts
{
	title: '{ slug } + intro'
}
```

## Directive Attributes

Some attributes are directives and use directive-specific parsing:

- `if` / `data-if`
- `else-if` / `data-else-if`
- `else` / `data-else`
- `data-each`
- `props` / `data-props`

### `if` and `else-if`

`if`/`else-if` conditions must use brace-wrapped expressions:

```html
<logo-component if="{ props.showLogo }" />
```

Unbraced values are invalid and cause a compile error.

### `each` and `data-each`

Loop directives must also use brace-wrapped expressions:

```html
<li each="{ item in items }">{ item }</li>
<li data-each="{ item in items }">{ item }</li>
```

Unbraced values like `each="item in items"` are invalid.

## `data-props` / `props` Object Semantics

`data-props` (or `props`) is for passing/spreading object props.

### Spread an existing object

```html
<script on:build>
	const data = { title: 'Hello', count: 42 }
</script>

<my-component data-props="{ ...data }" />
<my-component props="{ ...data }" />
```

Both produce:

```ts
{ title: 'Hello', count: 42 }
```

### Wrap object as a nested prop

```html
<my-component data-props="{ data }" />
```

This produces:

```ts
{ data: { title: 'Hello', count: 42 } }
```

This is valid, but the shape is different. Use this only when the receiving component expects a `data` prop.

## Practical Guidance

- Use **no braces** for text literals.
- Use **`{ ... }`** for dynamic values (booleans, numbers, computed strings, arrays, objects).
- For `data-props`, choose intentionally:
  - `data-props="{ ...data }"` to spread keys.
  - `data-props="{ data }"` to pass a nested object prop.
  - `data-props` (no value) to spread a local `props` variable.

## Why This Matters

Without braces on normal attributes, non-string values become strings. This can cause type/shape bugs, especially for booleans and object-like data.
