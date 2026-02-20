# CHANGELOG

### 1. v2 Script Taxonomy

We introduced a clearer three-type taxonomy for `<script>` tags, replacing the older `on:build`/`on:client` attributes:

- **`is:build`**: Build-time script (the render function body, executes on the server).
- **`is:bundled`**: Client module processed by Vite (supports HMR, bundling, and `import`).
- **`is:inline`**: Raw client script that is completely unprocessed and injected directly into the HTML as-is.

### 2. Built-in Data Passing (`pass:data`)

We implemented the `pass:data` directive which solves the problem of seamlessly threading build-time server context directly to the client runtime and CSS.

- **Inline Scripts**: `<script is:inline pass:data="{ { site } }">` evaluates your server data and safely block-scopes it (`{ const site = ... }`) into the client HTML without polluting `window`.
- **Bundled Scripts**: `<script is:bundled pass:data="{ { site } }">` proxies server-data to your Vite bundles using a **DOM JSON + Auto-Inject** architecture. It serializes the data into a hidden JSON tag (`<script type="application/json" id="__aero_data">`) and transparently prepends a destructuring read to your module scope.
- **Style Data Injection**: You can now pass build-time data to CSS using `<style pass:data="{ { bg: 'purple' } }">`. Aero compiles this into a `:root { --bg: purple; }` CSS variable block mapped globally!

### 3. Content Package API Enhancements

We overhauled `@aero-ssg/content` to vastly improve efficiency and discoverability:

- **`getCollection('name')`**: Replaced static exports with a typed `getCollection()` API fetching your schemas.
- **Lazy `render()`**: Markdown content no longer eagerly compiles. You can fetch a collection lightweight (for lists), and dynamically `await render(doc)` when viewing a specific page. It safely returns `{ html: '' }` without crashing if given empty inputs.
- **Props in `getStaticPaths`**: `getStaticPaths` now supports returning `{ params, props }`. Any injected props automatically flow down into `Aero.props` on the requested route.

### 4. Image Optimization

Integrated `vite-plugin-image-optimizer` directly into the framework core. It statically intercepts images required by templates (`<img src="...">`) and automatically applies `sharp` / `svgo` compression inside the build pipeline natively, saving ~20% of bundle thresholds automatically on static assets.

### 5. Monorepo Organization & Flat Assets

- **`src` Restructuring**: Both `packages/core` and `packages/content` were refactored into a standardized `src/` directory format for cleaner project hygiene, improving module resolution and typings.
- **Simplified Asset Output**: Removed aggressive sub-directory nesting in the Vite production output. Build assets (like `.css` and `.js` chunks) are now flattened cleanly into `dist/assets/[name]-[hash][extname]`.
