# The HTML `<template>` element in Aero

Aero treats **`<template>`** in two different ways, depending on whether you use **structural directives** on the tag (`if`, `else-if`, `else`, `for`, `data-for`, `switch`):

| Usage                                        | What appears in the generated HTML                                                                                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Structural directive on `<template>`**     | **Only the inner markup** — the `<template>` wrapper is **not** emitted. This is the **wrapperless** pattern: same logic as `<div if>` / `<li data-for>`, but without an extra element in the tree. |
| **Plain `<template>`** (no those directives) | A real **`<template>...</template>`** in the output. In the browser, that node stays **inert** (contents are not normal page content) until script moves or clones them — standard HTML behavior.   |

Use this page when you choose between a **wrapperless group** (no extra tag), a **literal inert** template (for JS), or a **restricted HTML context** where only certain tags are allowed.

---

## Why wrapperless `<template>` exists

**Correctness:** If Aero left a real `<template>` in the document for a conditional, loop, or `switch`, the browser would keep the inner nodes **inert** — they would not behave like normal rendered content. So for `if` / `for` / `switch` on `<template>`, the compiler **erases** the wrapper and emits only the children.

**Ergonomics:** You get a **single logical block** (multiple siblings, table rows, etc.) without inventing a non-standard tag. `<template>` is parser-recognized and often allowed where an extra `<div>` would break the content model (for example around `<tr>` in tables, or inside `<select>`).

---

## Wrapperless conditionals (`if` / `else-if` / `else`)

Use the same directives as on any other element; optional `data-` prefixes work the same.

```html
<template if="{ showDetails }">
	<dl class="details">…</dl>
</template>
<template else-if="{ showSummary }">
	<p class="summary">…</p>
</template>
<template else>
	<p>Default.</p>
</template>
```

**Mixed chains:** Branches do not all have to be `<template>`. You can pair a wrapperless `<template if>` with a `<section else-if>` that keeps its outer tag, and so on.

---

## Wrapperless loops (`for` / `data-for`)

Put the loop directive on `<template>` to repeat **only the inner fragment** without a wrapper element:

```html
<ul>
	<template data-for="{ const item of items }">
		<li>{ item.name }</li>
	</template>
</ul>
```

The list items are emitted as direct children of `<ul>`; no `<template>` node appears in the output.

---

## Wrapperless `switch` / `case` / `default`

Put `switch` / `data-switch` on **`<template>`** to match a discriminant against **`case`** branches without emitting an extra wrapper. Direct children of the container must be branch elements (`case` or `default`); see [props](props.md) for expression rules.

```html
<template switch="{ state }">
	<p case="loading">Loading…</p>
	<section case="ready">…</section>
	<p default>Fallback</p>
</template>
```

You can use the same pattern on a normal element (for example `<div switch="{ state }">`); the outer tag is preserved and only one branch’s children render inside it. Grouped matches use array syntax: `case="{ ['a', 'b'] }"`.

---

## Plain `<template>` (inert markup)

If you **do not** put `if` / `else-if` / `else` / `for` / `data-for` / `switch` on the `<template>` tag, Aero compiles it like a normal element: the generated HTML includes **`<template>...</template>`**. The inner markup is still compiled (interpolation, nested components, etc.) so build output and bundling stay consistent; in the live DOM that subtree remains **inert** until your client code clones or adopts it.

Use that when you intentionally keep markup **out of the visible tree** (prototypes, dialog bodies, chunks for `cloneNode`, and similar patterns).

---

## When to prefer `<template>` over `<div>`

- **Wrapperless structural directives** — You want a group of nodes **without** an extra wrapper in the output; use `<template if>` / `<template data-for>` / `<template switch>` as above.
- **Content models** — HTML only allows certain children in contexts like `<table>`, `<tbody>`, `<select>`, or lists. `<template>` is often valid where an extra `<div>` is not.
- **Inert markup for JavaScript** — You keep markup in a real `<template>` (no structural directive on the tag) until a script clones it.
- **No extra semantics** — Unlike `<div>`, `<template>` does not imply a generic block box; it is explicitly a non-rendered holder when used as a literal element.

---

## Attributes on wrapperless `<template>`

Directive attributes (`if`, `for`, `switch`, `case`, `default`, etc.) are compile-time only. **Normal** attributes on a wrapperless `<template>` (for example `class`) do **not** appear in the final HTML — there is no element to attach them to. Put classes and ARIA on a real element **inside** the fragment.

---

## See also

- [Getting started — Loops and Conditionals](getting-started.md#loops-and-conditionals) — Short examples and link here.
- [Interpolation — Loops](interpolation.md#loops-for--data-for) — `for` / `data-for` syntax and loop metadata.
- [Props](props.md) — Directive expression rules (`if="{ … }"`, `for="{ … }"`).

For compiler internals (e.g. `template.content` vs `childNodes`), see [\_reference/refactors/wrapperless/template-lowering-in-compiler.md](../_reference/refactors/wrapperless/template-lowering-in-compiler.md).
