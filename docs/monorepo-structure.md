# Monorepo Structure & Build Outputs

Aero utilizes a highly optimized internal monorepo structure using pnpm workspaces. Recently, we standardized the package topology to use consistent `src/` directories, leading to cleaner configurations, more reliable type checking, and drastically simplified build outputs.

## Package Topology

The framework is divided essentially into three primary nodes:

- **`packages/core`**: The rendering engine (`@aero-ssg/core`). Contains the linkedom HTML parser, the virtual module AST codegen, the universal JS runtime, and the heavy-lifting Vite plugin. This package is explicitly structured inside `packages/core/src/*`.
- **`packages/content`**: The markdown metadata loader (`@aero-ssg/content`). Exports Zod schemas and data fetching utilities. Also structured tightly within `packages/content/src/*`.
- **`packages/start`**: The consumer-facing scaffolding. This is the sandbox application that developers use to build Aero projects.

## Clean `dist/` Architectures

Previously, running `pnpm run build` from `packages/start` would emit chunk directories inside deeply chaotic hierarchies (e.g. `dist/assets/client/assets/styles/...`).

We have entirely resolved this convolution by leveraging dynamic `rollupOptions.output` path resolvers.

All static assets matching CSS stylesheets, JS chunks, and minified images are intelligently rewritten using `path.basename` logic.

**Resulting Flat Output Tree (`dist/assets/`):**

```bash
dist/
├── index.html
├── about/index.html
└── assets/
    ├── global.css-[hash].css      (All CSS hoisted here)
    ├── index.ts-[hash].js         (All JS hoisted here)
    ├── theme.ts-[hash].js
    └── about.jpg-[hash].jpg       (Optimized images hoisted here)
```

No nested directories, no routing conflict vectors. Everything behaves predictably out of a single flat asset directory.
