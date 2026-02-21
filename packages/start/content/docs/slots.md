---
published: true
title: Slot Passthrough
subtitle: Learn about the new slot passthrough feature in Aero, which allows you to forward named slots through a component hierarchy.
date: 2026-02-15
---

## ✅ Feature Implemented

You can now pass named slots through a component hierarchy using the following syntax:

```html
<slot name="nav" slot="nav"></slot>
```

This allows a component to receive a named slot from its parent and forward it to its own child component.

## How It Works

### Use Case: Three-Level Component Hierarchy

**Grandparent Component (page.html)**

```html
<parent-component>
	<div slot="nav">Custom Navigation Content</div>
	<div>Main content here</div>
</parent-component>
```

**Parent Component (parent.html)**

```html
<script is:build>
	import child from '@layouts/child'
</script>

<child-component>
	<!-- Receive 'nav' slot from grandparent and pass it to child -->
	<slot name="nav" slot="nav"></slot>

	<!-- Pass through default slot as well -->
	<slot></slot>
</child-component>
```

**Child Component (child.html)**

```html
<div class="wrapper">
	<nav>
		<!-- Renders the "Custom Navigation Content" from grandparent -->
		<slot name="nav">Default Nav</slot>
	</nav>

	<main>
		<!-- Renders "Main content here" from grandparent -->
		<slot>Default Content</slot>
	</main>
</div>
```

## Syntax Explanation

### Regular Slot (receiving content)

```html
<slot name="nav">Fallback content</slot>
```

- Receives content from parent's `slot="nav"` attribute
- Shows fallback if no content provided

### Slot Passthrough (receiving AND forwarding)

```html
<slot name="nav" slot="nav"></slot>
```

- **`name="nav"`**: Receives content from **parent** component
- **`slot="nav"`**: Forwards content to **child** component
- Supports fallback content between tags

## Implementation Details

The compiler generates the following code for slot passthrough:

```javascript
// For: <slot name="nav" slot="nav">Fallback</slot>
{
	nav: `${slots['nav'] || `Fallback`}`
}
```

This takes the `nav` slot from the component's received slots and passes it as the `nav` slot to the child component.

## Example in Your Codebase

In `client/layouts/sub.html`:

```html
<base-layout data-props>
	<slot name="nav" slot="nav"></slot>
	<slot></slot>
</base-layout>
```

This allows sub-layout to:

1. Receive a `nav` slot from any page that uses it
2. Pass that `nav` slot through to `base-layout`
3. Also pass through the default slot content
