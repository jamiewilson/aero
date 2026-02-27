# What Makes Aero Different?

Aero (`aerobuilt`) is a new kind of static site generator and full-stack framework. While it shares conceptual similarities with frameworks like Astro or Eleventy, its architectural decisions create a fundamentally different (and significantly lighter) developer experience.

Here is a breakdown of what makes Aero unique, and how it avoids reinventing the wheel by leaning on the giants of the modern web ecosystem.

---

## 🌟 The Unique & Compelling Features (The "Aero Way")

### 1. 100% HTML-First Authoring

Most modern frameworks invented their own file extensions (`.astro`, `.svelte`, `.jsx`, `.vue`). Aero uses plain `.html` files. Pages, components, and layouts are authored with standard HTML syntax (with a thin `{ }` interpolation layer). You never have to context-switch out of the native language of the web.

### 2. No Framework Compilers or VDOM

Aero fundamentally does not support compiling heavy JavaScript frameworks like React, Svelte, or Vue. By dropping the "bring any framework" promise, Aero eliminates the need for complex AST bridges, Virtual DOM runtimes, and enormous dependency trees. It is strictly a string-to-HTML template compiler.

### 3. Clear Build vs. Client Separation

Aero uses a drastically simplified mental model for where JavaScript executes:

- `<script is:build>`: Runs **only** at build time (or server request time). It is completely stripped from the final output.
- `<script>`: A standard module, bundled for the browser.
- `<script is:inline>`: Left in the HTML as-is to run immediately.

There are no confusing `client:load` or `client:visible` directives. If you write a standard script tag, it runs exactly as a browser expects it to.

### 4. Zero "Hydration" Orchestrators

Because Aero outputs raw static HTML rather than mounting a heavy JavaScript framework, it doesn't need a complex hydration orchestrator. If you want interactivity, you use Alpine.js, HTMX, or standard Web Components. The browser's native HTML parser handles the "hydration" instantly as the page loads.

### 5. Pass-Through by Default

Aero’s parser is designed to be dumb in a smart way. If you write `x-transition:enter="opacity-0"` or `hx-post="/api/submit"`, Aero doesn't try to parse, validate, or transform those attributes. It just blindly passes them through to the client. This means Aero has first-class support for libraries like Alpine.js and HTMX with **zero configuration or plugins needed**.

---

## 🤝 Standing on the Shoulders of Giants (Not Reinventing the Wheel)

Aero is intentionally small. Instead of building bespoke infrastructure, it adopts the best existing tools in the ecosystem:

### 1. Vite (The Engine)

Instead of building a custom dev server, HMR system, and bundler, Aero is essentially just a very smart **Vite plugin**.

- **Asset Resolution?** Vite handles it.
- **HMR?** Vite handles it.
- **Tailwind CSS?** You don't need an official `@aerobuilt/tailwind` integration. You just use standard Vite PostCSS plugins.

### 2. Nitro (The Server)

When you need more than just a static `dist/` folder, Aero delegates its server responsibilities entirely to **Nitro** (the engine behind Nuxt). This instantly gives Aero:

- File-based API routes (`server/api/`)
- Universal deployment (Vercel, Cloudflare, Deno, Node, etc.)
- Standardized request middleware
  Aero didn't have to invent a custom deployment adapter ecosystem; Nitro already did it.

### 3. Native Web Standards (HTML/CSS/JS)

Aero does not reinvent styling with bespoke CSS-in-JS abstractions or scoped CSS compilers. It assumes you will write standard CSS modules or use utility frameworks like Tailwind. It does not invent a new reactivity model; it leaves reactivity to standard DOM events or lightweight libraries like Alpine.js.

### 4. Vitest & Monorepo Tooling

The Aero framework itself is built using the standard modern open-source stack: `pnpm` workspaces, `tsup` for package building, and `vitest` for robust, fast unit testing.

---

### In Summary

Aero is the antithesis of the "kitchen sink" metaframework. It is a thin, performant HTML compiler layered on top of standard tools like Vite and Nitro, designed specifically for developers who want to write "HTML over the wire" without fighting a towering stack of Javascript abstractions.
