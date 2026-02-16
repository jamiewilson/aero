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

## Directive Attributes

Some attributes are directives and use directive-specific parsing:

- `if` / `data-if`
- `else-if` / `data-else-if`
- `else` / `data-else`
- `data-each`
- `props` / `data-props`

### `if` and `else-if`

`if`/`else-if` conditions are treated as expressions, so these are equivalent:

```html
<logo-component if="props.showLogo" />
<logo-component if="{ props.showLogo }" />
```

Both evaluate the condition expression.

## `data-props` / `props` Object Semantics

`data-props` (or `props`) is for passing/spreading object props.

### Spread an existing object

```html
<script on:build>
	const data = { title: 'Hello', count: 42 }
</script>

<my-component data-props="data" />
<my-component data-props="{ ...data }" />
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
  - `data-props="data"` or `data-props="{ ...data }"` to spread keys.
  - `data-props="{ data }"` to pass a nested object prop.

## Why This Matters

Without braces on normal attributes, non-string values become strings. This can cause type/shape bugs, especially for booleans and object-like data.
