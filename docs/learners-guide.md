# Learner's Guide: What Is Native Web and What Is Aero?

### The problem

When you are new to HTML and CSS, Aero can be a little confusing at first because Aero files look very close to normal web files. That is a strength, but it also means it is easy to miss which parts come from the browser and which parts only work because Aero interprets them.

For example, all of these can appear in one file:

```html
<script is:build>
	import card from '@components/card'
	const title = 'Hello'
</script>

<card-component>
	<h1>{ title }</h1>
</card-component>
```

Some of that is close to normal HTML. Some of it is Aero-only.

---

### What this looks like without Aero

In plain web development, the browser understands HTML elements, CSS rules, and ordinary client-side JavaScript. It does not understand things like:

- `{ title }` inside HTML,
- `<script is:build>`,
- `if`, `for`, `switch`, or `props` as template directives,
- file-based routing from your `client/pages/` folder,
- importing an `.html` file and then writing `<card-component>`.

Without a guide, a beginner can accidentally learn "HTML" and "Aero" as if they were the same thing.

---

### How Aero helps

Aero tries to keep most of your authoring model close to the web platform:

- your files are still `.html`,
- your styles are still CSS,
- your client scripts are still browser JavaScript,
- HTMX and Alpine attributes are preserved,
- the framework adds a fairly small template and build layer on top.

This guide shows where that extra layer begins.

---

### What stays native in Aero

These things are still ordinary web-platform features:

- normal HTML elements like `<div>`, `<p>`, `<a>`, `<img>`, `<form>`, and `<template>`
- normal CSS inside `<style>`
- normal browser JavaScript inside a plain `<script>`
- normal HTML attributes like `class`, `id`, `href`, `src`, `alt`, `aria-*`, and `data-*`
- normal URLs and links
- normal HTMX attributes like `hx-get` and `hx-post`
- normal Alpine attributes like `x-data`, `x-show`, `:class`, and `@click`

If the browser could understand it in a regular HTML file by itself, it is probably native web.

---

### The quick rule of thumb

Use this shortcut:

- If the browser can understand it on its own, it is native web.
- If Aero evaluates it during build time or render time, it is Aero behavior.

There are a few important mixed cases:

- `<slot>` is a native HTML element, but Aero uses it as part of its layout and component system.
- `data-*` is native HTML syntax, but `data-if`, `data-for`, `data-switch`, and `data-props` are Aero directives.
- Plain `<script>` is native, but Aero can still bundle local scripts and pass data into them with `props`.

---

# Aero-only template syntax

## `{ }` interpolation — **Aero-only**

Problem: plain HTML has no built-in way to evaluate JavaScript expressions inside markup at build time.

Without Aero, this does not work in a static HTML file:

```html
<h1>{ title }</h1>
```

With Aero, `{ expression }` is evaluated and the result is inserted into the output.

```html
<script is:build>
	const title = 'Hello'
</script>

<h1>{ title }</h1>
```

---

## `if`, `else-if`, and `else` — **Aero-only**

Problem: HTML has no native conditional rendering syntax.

Aero adds conditional directives directly in markup:

```html
<div if="{ user }">Hello, { user.name }</div>
<p else>Not logged in.</p>
```

These attributes are interpreted by Aero. The browser does not know what they mean.

---

## `for` and `data-for` — **Aero-only**

Problem: HTML has no native loop syntax.

Aero adds loop directives so one element or fragment can repeat:

```html
<ul>
	<li data-for="{ const item of items }">{ item.name }</li>
</ul>
```

`data-for` uses valid HTML attribute syntax, but the looping behavior still comes from Aero.

---

## `switch`, `case`, and `default` — **Aero-only**

Problem: HTML has no native branching syntax for matching one value against several cases.

Aero adds `switch`, `case`, and `default` directives:

```html
<template switch="{ state }">
	<p case="loading">Loading...</p>
	<p case="ready">Ready.</p>
	<p default>Fallback.</p>
</template>
```

---

## `props` and `data-props` — **Aero-only**

Problem: HTML attributes are just attributes. They do not natively create a component props system or pass build-time data into scripts and styles.

Aero adds `props` for components, client scripts, and styles:

```html
<script is:build>
	const cardProps = { title: 'Hello', accent: 'blue' }
</script>

<card-component props="{ ...cardProps }" />
```

You can also use `props` on `<script>` and `<style>` to thread build-time data into the browser-facing parts of the template.

---

## `<script is:build>` — **Aero-only**

Problem: in plain HTML, a `<script>` tag is a browser script. There is no native browser feature called "run this only during the build."

Aero adds `is:build`:

```html
<script is:build>
	const title = 'Built by Aero'
</script>
```

This runs in Aero's server-side/build environment, not in the browser. For static builds, it runs at build time. In dev or other request-time rendering contexts, it runs on the server when the page is rendered.

---

## `<script is:inline>` and `<script is:blocking>` — **Aero-only**

Problem: plain HTML has inline scripts, but it does not have Aero's extra script modes.

Aero adds:

- `is:inline` to leave a script in place in the HTML
- `is:blocking` to hoist a script into `<head>` for early execution

```html
<script is:inline>
	document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light'
</script>
```

---

## Imported `.html` components and layouts — **Aero-only**

Problem: HTML does not have a native file-import-based component system for static templates.

In Aero, you can import an `.html` template and use it as a component or layout:

```html
<script is:build>
	import header from '@components/header'
	import base from '@layouts/base'
</script>

<base-layout>
	<header-component title="Hello" />
</base-layout>
```

The browser does not natively know that `header.html` becomes `<header-component>`.

---

## Slots and slot passthrough — **Mixed**

Problem: reusable layout composition is awkward in plain HTML files.

Aero uses `<slot>` inside layouts and components so parent markup can fill those holes.

```html
<!-- layouts/base.html -->
<html>
	<body>
		<header>Site header</header>
		<slot />
	</body>
</html>
```

Important nuance:

- `<slot>` itself is a native HTML element.
- Using it as part of Aero's layout and component composition model is Aero behavior.
- Slot passthrough across nested layouts is also Aero behavior.

---

## Wrapperless `<template>` directives — **Mixed**

Problem: sometimes you need a loop or conditional around several sibling elements, but you do not want an extra wrapper like `<div>` in the output.

Aero lets `<template>` act as a wrapperless control-flow container when it has structural directives:

```html
<ul>
	<template data-for="{ const item of items }">
		<li>{ item.name }</li>
	</template>
</ul>
```

Plain `<template>` is native HTML and stays inert in the browser. But `<template if>`, `<template data-for>`, and `<template switch>` get special Aero compiler behavior.

---

# Framework features Aero adds beyond native web

The items above are mostly template syntax. Aero also gives you framework features that do not exist in the web platform by itself.

---

## File-based routing — **Aero-only**

Problem: the browser does not turn your project folders into routes.

In Aero, files in `client/pages/` become URLs:

- `client/pages/index.html` -> `/`
- `client/pages/about.html` -> `/about`
- `client/pages/docs/index.html` -> `/docs`

---

## Dynamic routes and `getStaticPaths()` — **Aero-only**

Problem: the web platform does not know how to pre-generate many route variations from one template file.

Aero supports route files like `client/pages/docs/[slug].html` and uses `getStaticPaths()` to decide which concrete pages to build.

---

## Content collections and `aero:content` — **Aero-only**

Problem: HTML does not have a built-in content layer for validated collections and Markdown rendering.

Aero adds a content system with tools like:

- `aero.content.ts`
- `defineCollection()`
- `getCollection()`
- `render()`

---

## Optional Nitro server features — **Aero framework feature built on Nitro**

Problem: the browser does not provide project-level API routes, deployment presets, storage, cache, or server middleware.

Aero can stay static-only, but if you enable `server: true`, it integrates Nitro for things like:

- `server/api/`
- Nitro middleware
- storage and cache APIs
- deployment targets for server output

These are not native web features. They are framework and server features.

---

## Local script bundling and HMR — **Aero toolchain feature built on Vite**

Problem: the browser can run scripts, but it does not bundle modules, rewrite asset URLs, or hot-reload your project during development.

Aero, through Vite, gives you:

- bundled local scripts
- asset processing
- hot module replacement during development
- production build output

---

## Tooling and editor support — **Aero-only tooling**

Problem: the web platform does not ship framework-aware diagnostics for Aero templates.

Aero adds tooling such as:

- the VS Code extension
- language-server diagnostics
- IntelliSense for build scripts and template features
- `aero check` and related CLI checks

---

## Path aliases and project conventions — **Aero-only**

Problem: browsers do not know repo-level path aliases like `@components` or `@layouts`, and they do not assign framework meaning to folders like `client/pages/` or `content/`.

Aero projects commonly use conventions such as:

- `@components/*`
- `@layouts/*`
- `@pages/*`
- `@content/*`

These are developer conveniences provided by the framework and toolchain.

---

## Optional image optimization and incremental build support — **Aero-only build feature**

Problem: the browser does not optimize your image pipeline or skip unchanged pages during your build.

Aero adds optional framework-level build features such as image optimization and incremental static build support.

---

## Native vs Aero cheat sheet

| What you see                            | Native web or Aero?           | What actually handles it                                      |
| --------------------------------------- | ----------------------------- | ------------------------------------------------------------- |
| `<div>`, `<p>`, `<a>`                   | Native web                    | Browser                                                       |
| `<style>` with normal CSS               | Native web                    | Browser                                                       |
| Plain `<script>`                        | Native web                    | Browser, with Vite bundling when Aero processes local modules |
| `hx-*`, `x-*`, `:class`, `@click`       | Not Aero syntax               | HTMX or Alpine in the browser                                 |
| `{ title }`                             | Aero                          | Aero template engine                                          |
| `if`, `else-if`, `else`                 | Aero                          | Aero template engine                                          |
| `for`, `data-for`                       | Aero                          | Aero template engine                                          |
| `switch`, `case`, `default`             | Aero                          | Aero template engine                                          |
| `props`, `data-props`                   | Aero                          | Aero template engine                                          |
| `<script is:build>`                     | Aero                          | Aero build or server-side render runtime                      |
| `<script is:inline>`                    | Aero syntax on native element | Aero compiler leaves it in place                              |
| `<script is:blocking>`                  | Aero syntax on native element | Aero compiler hoists it                                       |
| `<header-component>` from `header.html` | Aero                          | Aero component system                                         |
| `<base-layout>` from `base.html`        | Aero                          | Aero layout system                                            |
| `<slot>` inside an Aero layout          | Mixed                         | Native element used by Aero composition                       |
| `<template data-for>`                   | Mixed                         | Native element with Aero directive behavior                   |
| `client/pages/about.html` -> `/about`   | Aero                          | Aero routing                                                  |
| `[slug].html` + `getStaticPaths()`      | Aero                          | Aero routing and build system                                 |
| `getCollection()` and `render()`        | Aero                          | Aero content layer                                            |
| `server/api/*` with `server: true`      | Aero app capability           | Nitro server layer                                            |
| `@components/header`                    | Aero                          | Toolchain path alias resolution                               |
| HMR, build output, asset hashing        | Aero app capability           | Vite toolchain                                                |

## Final mental model

The simplest way to think about Aero is this:

- The browser still handles normal HTML, CSS, and client JavaScript.
- Aero adds a template layer, a file-based project structure, and a build pipeline.
- When you are unsure, ask: "Would this still mean anything in a plain HTML file opened directly by the browser?"

If the answer is no, you are probably looking at an Aero feature.
