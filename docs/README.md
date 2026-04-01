# Aero Documentation

This directory contains the main documentation for the [Aero](https://github.com/jamiewilson/aero) framework. The root [README](../README.md) gives a short overview and quick start.

## Getting started

- **[Getting Started](getting-started.md)** — Build your first Aero project: pages, components, layouts, data, and scripts.
- **[Overview](overview.md)** — What Aero is, core stack and philosophy, and what it supports (with links to deeper docs).
- **[What Makes Aero Different?](what-makes-aero-different.md)** — Aero's architectural philosophy and differences from standard frameworks.
- **[Why Not Web Components?](why-not-web-components.md)** — A comparison of Aero's approach versus standard Web Components.

## Routing and pages

- **[Routing](routing.md)** — File-based routing, static and dynamic routes, `getStaticPaths`, and template context.

## Components and templating

- **[Interpolation](interpolation.md)** — `{ }` expressions in text and attributes, `{{`/`}}` escapes, and `props` semantics (spread for object properties as CSS vars).
- **[Props guide](props.md)** — Passing and receiving props, how attribute values work, `props`, and globals.
- **[Slot passthrough](slot-passthrough.md)** — Passing named slots through layout hierarchies.
- **[TypeScript guide](typescript-guide.md)** — Typing props, content globals, collections, and ambient types for type-safe build scripts.

## Scripts and data

- **[Script taxonomy](script-taxonomy.md)** — Script types (`is:build`, plain `<script>`, `is:inline`, `is:blocking`, `src`), behavior, and `props` with multiple instances.
- **[props directive](props-directive.md)** — Threading build-time data into client scripts and `<style>`.
- **[Importing and bundling](importing-and-bundling.md)** — How client scripts are bundled; options (single bundle, CDN + globals, externals, code-splitting) for htmx, Alpine, and other deps.

## Content and configuration

- **[Content API](content-api.md)** — Content collections, `getCollection()`, `render()`, and `getStaticPaths` with props.
- **[Dependency policy](dependency-policy.md)** — Catalog vs overrides vs explicit versions, plus CI guardrails.
- **[Site URL](site-url.md)** — Canonical URL, sitemap, and `Aero.site` / `import.meta.env.SITE`.
- **[Environment variables](environment-variables.md)** — Vite env, `VITE_` prefix, `.env` files, and TypeScript.
- **[Middleware and redirects](middleware.md)** — Request-time middleware (dev) and config redirects.

## Image Handling

- **[Image optimization](image-optimization.md)** — Optional image pipeline during build.

## Server and client libraries

- **[Nitro](nitro-overview.md)** — `server: true`, root `nitro.config.ts`, Nitro-native APIs, storage, cache, database, tasks, plugins, and deployment presets.
- **[HTMX and Alpine](htmx-and-alpine.md)** — Using htmx and Alpine.js with Aero, including together.

## Testing and contribution

- **[Testing](testing.md)** — Repo-level Vitest and Playwright commands, CI policy, selector guidance, and shared E2E harness conventions.
