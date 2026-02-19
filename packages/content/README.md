# Aero Content Package

## Overview

The Aero Content package provides a flexible content loader, parser, and renderer for static site generation. It powers the `aero:content` module, enabling you to fetch, transform, and render content collections (such as Markdown files) for use in Aero apps. This package is designed for seamless integration with Aero’s template engine and build pipeline.

## Features

### 1. Content Collection Loader
- **getCollection(name: string): Promise<Array<Doc>>**
  - Loads all documents from a named collection (e.g., `docs`, `guides`).
  - Supports nested folders and custom content structures.

### 2. Markdown Parsing
- Parses Markdown files into structured content objects.
- Extracts frontmatter (YAML/JSON) for metadata (title, subtitle, published, etc).
- Supports nested collections and custom fields.

### 3. Content Rendering
- **render(doc: Doc): Promise<{ html: string, data: object }>**
  - Converts parsed Markdown content into HTML.
  - Returns both rendered HTML and extracted metadata.

### 4. Type Definitions
- Provides TypeScript types for content documents, collections, and metadata.
- Ensures type safety for content operations in Aero apps.

### 5. Vite Integration
- Exposes a Vite plugin for content hot-reloading and build-time content resolution.
- Enables `aero:content` alias for easy imports in templates and scripts.

### 6. Test Coverage
- Includes Vitest tests for loader, markdown parsing, rendering, and Vite plugin.
- Test fixtures for valid and invalid content scenarios.

## Usage Example

```js
import { getCollection, render } from 'aero:content'

export async function getStaticPaths() {
  const docs = await getCollection('docs')
  return docs.map(doc => ({ params: { slug: doc.id }, props: doc }))
}

const doc = Aero.props
const { html } = await render(doc)
```

## File Structure

- `src/loader.ts` — Loads content collections
- `src/markdown.ts` — Parses Markdown files and frontmatter
- `src/render.ts` — Renders content to HTML
- `src/types.ts` — TypeScript types for content
- `src/vite.ts` — Vite plugin integration
- `__tests__/` — Test suite and fixtures

## Supported Content Features
- Markdown with frontmatter
- Nested collections (folders)
- Custom metadata fields
- Static path generation for dynamic routes
- Hot-reloading in development
