Here is a comprehensive checklist to help you track your framework's development. I’ve organized these by "Core Engine" and "Developer Experience" to help you prioritize the build order.

### 🏗️ Phase 1: The Core Engine

- [ ] **Project Initializer:** A basic CLI or script to scaffold a new project (`npm init my-framework`).
- [x] **Fast Bundler Integration:** Setup with esbuild, Vite, or SWC for lightning-fast builds.
- [x] **Dev Server with HMR:** Hot Module Replacement that updates the browser without losing state.
- [-] **Production Build Command:** A script to minify, tree-shake, and output a deployment-ready `dist` folder.

### 📄 Phase 2: Routing & Layouts

- [x] **File-Based Routing:** Mapping the `src/pages` directory to URL paths.
- [ ] **Dynamic Routes:** Support for slugs and parameters (e.g., `/blog/[id].html`).
- [x] **Global Layouts:** A wrapper system to avoid repeating `<head>` and `<footer>` on every page.
- [ ] **Nested Routing:** Support for sub-directories (e.g., `/dashboard/settings`).

### 🧩 Phase 3: Component System

- [x] **Single File Components (SFC):** A unified format for HTML, CSS, and JS.
- [x] **Component Nesting:** The ability to import and use components inside other components.
- [x] **Props System:** Passing data into components via attributes.
- [x] **Slots / Transclusion:** Using `<slot>` to pass HTML content into a component's layout.
- **Scoped Styling:** Will rely on native CSS scoping via the @scope and :scoped selector.

### 🚀 Phase 4: Modern DX & Assets

- [ ] **Top-Level Await:** Support for fetching data at the top of a script block.
- [ ] **Asset Pipeline:** Automatic handling of images, fonts, and global CSS imports.
- [ ] **Image Optimization:** Automatic conversion to WebP/Avif and responsive resizing.
- [ ] **Markdown Support:** Built-in parsing for `.md` files (essential for blogs/docs).
- [ ] **Zero-JS Output:** A "Static-First" mode where no framework JS is sent to the client unless requested.

### 🛠️ Phase 5: Advanced Features

- [ ] **Middleware/Hooks:** Functions that run before a page is rendered.
- [ ] **TypeScript Support:** Out-of-the-box transpilation for `.ts` files.
- [ ] **Sitemap & SEO Tools:** Automatic generation of `sitemap.xml` and metadata helpers.

---

### Pro-Tip for Staying "Native"

Since you want it to feel like native web tech, try to use **Standard Web Components** for your Phase 3. If you can make your framework's components compatible with `customElements.define()`, you’ll be building on a foundation that will last for decades.

**Would you like me to help you design a specific "SFC" file extension or syntax for your components?**
