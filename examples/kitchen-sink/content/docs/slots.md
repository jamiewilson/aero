---
published: true
title: Slots
subtitle: Compose layouts with default and named slots, and forward slots through the component hierarchy.
---

Slots let you pass content into a component and choose where it is rendered. You can also **pass through** a named slot from a parent to a child so multi-level layouts stay simple.

## Basic slots

**Receiving content:** Use `<slot>` for the default content, or `<slot name="nav">` for a named slot. Content from the parent that has `slot="nav"` goes into the named slot; everything else goes into the default slot.

```html
<slot name="nav">Fallback content</slot>
```

- Receives content from the parent’s `slot="nav"` attribute.
- The optional content between the tags is fallback when nothing is provided.

## Slot passthrough

To receive a slot from the parent and forward it to your own child component, use both `name` and `slot` on the same `<slot>`:

```html
<slot name="nav" slot="nav"></slot>
```

- **name="nav"** — Receive the `nav` slot from the parent.
- **slot="nav"** — Pass that content as the `nav` slot to the child.

You can put fallback content between the tags if you like.

## Example: three-level hierarchy

**Page (grandparent):**

```html
<parent-component>
	<div slot="nav">Custom Navigation Content</div>
	<div>Main content here</div>
</parent-component>
```

**Parent (e.g. client/layouts/parent.html):**

```html
<script is:build>
	import child from '@layouts/child'
</script>

<child-component>
	<slot name="nav" slot="nav"></slot>
	<slot></slot>
</child-component>
```

**Child (e.g. client/layouts/child.html):**

```html
<div class="wrapper">
	<nav>
		<slot name="nav">Default Nav</slot>
	</nav>
	<main>
		<slot>Default Content</slot>
	</main>
</div>
```

The page’s “Custom Navigation Content” ends up in the child’s `nav` slot; “Main content here” ends up in the default slot.

## Example in a layout

In `client/layouts/sub.html` you can forward slots to a base layout:

```html
<base-layout props>
	<slot name="nav" slot="nav"></slot>
	<slot></slot>
</base-layout>
```

Then any page that uses this layout can pass a `nav` slot and main content; both are forwarded to `base-layout`.
