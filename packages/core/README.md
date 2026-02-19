# Aero Core Package

## Overview

The Aero Core package is the heart of the Aero static site generator. It provides the compiler, runtime, and Vite plugin that power Aero’s HTML-first template engine, component system, and build pipeline. This package is designed for flexibility, performance, and seamless integration with modern frontend tooling.

## Features

### 1. Template Compiler

- Parses Aero HTML templates, extracting `<script on:build>` and `<script on:client>` blocks.
- Compiles templates into async render functions with `{ }` interpolation for dynamic content.
- Supports custom component syntax, slot passthrough, and data loops.

#### Example

```html
<script on:build>
	import header from '@components/header'
</script>
<header-component title="{ site.title }" />
```

### 2. Runtime Engine

- Provides the `Aero` class for rendering pages and components with context.
- Handles props, slots, and global data injection.

#### Example

```js
import { Aero } from '@aero-ssg/core'
const html = await Aero.render(page, context)
```

### 3. Vite Plugin

- Integrates Aero templates and components into the Vite build process.
- Handles virtual modules for client scripts (`/@aero/client/`), HMR, and middleware for serving pages.

#### Example

```js
import { aeroVitePlugin } from '@aero-ssg/vite'
export default {
	plugins: [aeroVitePlugin()],
}
```

### 4. Component & Layout System

- Supports reusable components (`-component`) and layouts (`-layout`) with slot support.
- Props passed via attributes or `data-props`.

#### Example

```html
<my-component title="{ site.title }" />
<my-layout>
	<slot name="main">{ content }</slot>
</my-layout>
```

### 5. Path Aliases

- Resolves path aliases for components, layouts, pages, content, assets, and server files.
- Simplifies imports in templates and scripts.

### 6. Client Stack Integration

- Preserves Alpine.js and HTMX attributes for client-side interactivity.
- Skips interpolation for attributes matching `^(x-|[@:.]).*`.

### 7. Test Coverage

- Includes Vitest tests for compiler, runtime, and Vite plugin.

## File Structure

- `src/compiler/` — Parser, codegen, helpers, resolver
- `src/runtime/` — Aero class and rendering logic
- `src/utils/` — Aliases, routing utilities
- `src/vite/` — Vite plugin and build integration
- `__tests__/` — Test suite for compiler, runtime, and Vite

## Usage Example

**Compile and Render a Page:**

```js
import { parse, codegen } from '@aero-ssg/core/compiler'
const ast = parse(template)
const renderFn = codegen(ast)
const html = await renderFn(context)
```

**Vite Plugin Setup:**

```js
import { aeroVitePlugin } from '@aero-ssg/vite'
export default {
	plugins: [aeroVitePlugin()],
}
```

## Supported Features

- HTML-first templates with build/client scripts
- Component and layout system with slots
- Dynamic props and data interpolation
- Path alias resolution
- Client stack integration (Alpine.js, HTMX)
- Static site generation and HMR
