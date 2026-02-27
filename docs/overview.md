# Overview

What Aero is, how it fits together, and what it supports.

## What is Aero?

Aero is a **static site generator** with a custom **HTML-first template engine**. You write `.html` files with optional `<script>` and `<style>`, and use `{ }` for expressions. Markup stays close to native HTML.

### Core stack

| Tool       | Role                        | Why it helps                                   |
| ---------- | --------------------------- | ---------------------------------------------- |
| **Vite**   | Dev server & bundler        | Fast HMR, plugin system, asset bundling        |
| **Nitro**  | Server engine               | API routes, optional server deployment         |
| **HTMX**   | Client/server interactivity | Dynamic HTML updates without full page reloads |
| **Alpine** | Lightweight JS framework    | Declarative UI in the markup                   |

- [Vite](https://vitejs.dev/) · [Nitro](https://nitro.build/) · [HTMX](https://htmx.org/) · [Alpine.js](https://alpinejs.dev/)

### Core idea

- **Build time:** The parser extracts `<script is:build>` and plain `<script>` (client). Build scripts run in Node; they import components, read content, and prepare data. Client scripts are bundled by Vite. Templates are compiled into async render functions that output HTML.
- **Output:** By default you get a static `dist/`. With `nitro: true`, you also get a Nitro server for API routes.
- **Client:** HTMX and Alpine attributes are preserved so they run in the browser as-is. Aero does not own the DOM.

### Design goals

- **Native HTML feel** — File-based routing with `.html` in `client/pages/`; components and layouts are HTML.
- **Clear execution model** — `<script is:build>` runs only at build/request time; plain `<script>` is the client bundle.
- **Optional server** — Static-first; enable Nitro when you need API routes.
- **Compatibility with HTMX and Alpine** — `hx-*` and `x-*` (and `:`, `@`, `.`) are left alone; use `{ }` for Aero expressions.

---

## What Aero supports

### Core engine

- **Vite** — Dev server, HMR, production build via the Aero Vite plugin.
- **Static build** — Output to `dist/` with minification and optional Nitro output in `.output/`.
- **create-aerobuilt** — Scaffold from the minimal template. See [monorepo-and-packages.md](monorepo-and-packages.md#packagescreate-aerobuilt-create-aerobuilt). Full demo in [examples/kitchen-sink](../examples/kitchen-sink).

### Routing and layouts

- **File-based routing** — `client/pages/*.html` maps to URLs. [routing.md](routing.md)
- **Dynamic routes** — `[param].html` and `getStaticPaths()` for static generation. [routing.md](routing.md)
- **Layouts and slots** — Layouts wrap pages; `<slot>` for content; slot passthrough. [slot-passthrough.md](slot-passthrough.md)

### Components and templating

- **Single-file components** — HTML + optional `<script is:build>`, `<script>`, `<style>`.
- **Props** — Attributes or `props`; read via `aero.props`. [props.md](props.md)
- **Conditionals and loops** — `if` / `else-if` / `else`, `each` with `{ }` expressions.
- **Scoped styling** — Native CSS (e.g. `@scope`) in `<style>` blocks.

### Scripts and data

- **Script types** — `is:build`, plain `<script>` (client), `is:inline`, `is:blocking`, `src`. [script-taxonomy.md](script-taxonomy.md)
- **pass:data** — Thread build-time data into client scripts and `<style>`. [pass-data-directive.md](pass-data-directive.md)
- **Content** — `content/` modules (e.g. `site.ts`), collections with `getCollection()` and `render()`. [content-api.md](content-api.md)

### Configuration and environment

- **Site URL** — Canonical URL, sitemap, `Aero.site` / `import.meta.env.SITE`. [site-url.md](site-url.md)
- **Environment variables** — Vite’s `import.meta.env`, `VITE_` prefix, `.env`. [environment-variables.md](environment-variables.md)
- **Redirects and middleware** — Config redirects and request-time middleware (dev). [middleware.md](middleware.md)

### Assets and tooling

- **Image optimization** — Optional pipeline during build. [image-optimization.md](image-optimization.md)
- **VS Code extension** — Syntax and diagnostics (packages/aero-vscode).
- **TypeScript** — Scripts and content; path aliases from tsconfig.

### Server and client libraries

- **Nitro** — `aero({ nitro: true })`; API in `server/api/`, catch-all for static. [nitro-overview.md](nitro-overview.md)
- **HTMX and Alpine** — Use directly; attributes preserved. [htmx-and-alpine.md](htmx-and-alpine.md)
