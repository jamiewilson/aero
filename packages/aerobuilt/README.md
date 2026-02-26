# Aero

**Aero** (`aerobuilt` on npm) is an HTML-first static site generator powered by Vite. Write pages, components, and layouts in plain `.html` with `{ }` expressions — Aero compiles them at build time and outputs static HTML.

## Quick Start

```bash
pnpm create aero my-app
cd my-app
pnpm dev
```

Or with npm / yarn:

```bash
npx create-aero@latest my-app
yarn create aero my-app
```

## Install

To add Aero to an existing project:

```bash
pnpm add aerobuilt
```

```bash
npm install aerobuilt
yarn add aerobuilt
```

## Features

- **HTML-first templates** — No custom file format. Pages and components are `.html` files with `{ }` interpolation.
- **Build-time rendering** — `<script is:build>` runs at build time for data fetching, imports, and logic. Only static HTML ships to the browser.
- **Component system** — Import components and layouts, pass props via attributes, use slots for composition.
- **File-based routing** — `client/pages/about.html` → `/about`. Dynamic routes with `[slug].html`.
- **Content collections** — Markdown with frontmatter, Zod schemas, and `getCollection()` / `render()`.
- **Vite-powered** — HMR in dev, optimized builds, CSS/JS bundling.
- **Optional server** — Add Nitro for API routes and server-side rendering.
- **Works with Alpine.js & HTMX** — Aero preserves `x-data`, `hx-post`, etc. without interference.

## Usage

### Vite Plugin (minimal)

```ts
// vite.config.ts
import { aero } from 'aerobuilt/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: aero(),
})
```

### With Aero Config (full)

```ts
// aero.config.ts
import { defineConfig } from 'aerobuilt/config'

export default defineConfig({
	site: 'https://example.com',
	content: true,
	server: true,
})
```

```ts
// vite.config.ts
import { createViteConfig } from 'aerobuilt/config'
import aeroConfig from './aero.config'

export default createViteConfig(aeroConfig)
```

## Exports

| Import path         | What it provides                                            |
| ------------------- | ----------------------------------------------------------- |
| `aerobuilt`         | Default Aero client instance with `mount()`                 |
| `aerobuilt/vite`    | `aero()` Vite plugin                                        |
| `aerobuilt/config`  | `defineConfig`, `createViteConfig`, config types            |
| `aerobuilt/content` | `defineCollection`, `defineConfig`, `render`, content types |

## Templates

`create-aero` ships two starter templates:

- **minimal** (default) — Pages, layouts, components, `site.ts`. No server, no content collections.
- **kitchen-sink** — Full demo: content collections, Nitro API, Alpine.js, HTMX, dynamic routes.

```bash
pnpm create aero my-app                        # minimal
pnpm create aero my-app --template kitchen-sink # full
```

## Commands

| Command        | Description              |
| -------------- | ------------------------ |
| `pnpm dev`     | Vite dev server with HMR |
| `pnpm build`   | Static build to `dist/`  |
| `pnpm preview` | Preview built site       |

## Links

- [GitHub](https://github.com/aerobuilt/aero)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=aerobuilt.aero-vscode)

## License

MIT
