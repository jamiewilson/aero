# Aero Documentation

This directory contains the main documentation for the [Aero](https://github.com/aerobuilt/aero) framework. The root [README](../README.md) gives a short overview and quick start.

## Getting started

- **[Getting Started](getting-started.md)** — Build your first Aero project: pages, components, layouts, data, and scripts.
- **[Overview](overview.md)** — What Aero is, core stack and philosophy, and what it supports (with links to deeper docs).

## Routing and pages

- **[Routing](routing.md)** — File-based routing, static and dynamic routes, `getStaticPaths`, and template context.

## Components and templating

- **[Props guide](props_guide.md)** — Passing and receiving props, how attribute values work, `data-props`, and globals.
- **[Slot passthrough](slot-passthrough.md)** — Passing named slots through layout hierarchies.

## Scripts and data

- **[Script taxonomy](script-taxonomy.md)** — Script types (`is:build`, plain `<script>`, `is:inline`, `is:blocking`, `src`), behavior, and `pass:data` with multiple instances.
- **[pass:data directive](pass-data-directive.md)** — Threading build-time data into client scripts and `<style>`.
- **[Importing and bundling](importing-and-bundling.md)** — How client scripts are bundled; options (single bundle, CDN + globals, externals, code-splitting) for htmx, Alpine, and other deps.

## Content and configuration

- **[Content API](content-api.md)** — Content collections, `getCollection()`, `render()`, and `getStaticPaths` with props.
- **[Site URL](site-url.md)** — Canonical URL, sitemap, and `Aero.site` / `import.meta.env.SITE`.
- **[Environment variables](environment-variables.md)** — Vite env, `VITE_` prefix, `.env` files, and TypeScript.

## Build and deployment

- **[Monorepo and packages](monorepo-and-packages.md)** — Package layout, build flow, create-aero, and build output (dist/, assets).
- **[Image optimization](image-optimization.md)** — Optional image pipeline during build.

## Server and client libraries

- **[Nitro](nitro-overview.md)** — API routes, handlers, storage, database, and optional prerender (when `nitro: true`).
- **[HTMX and Alpine](htmx-and-alpine.md)** — Using htmx and Alpine.js with Aero, including together.
