# create-aero

Project initializer for [Aero](https://github.com/aero-ssg/aero). Scaffolds a new app from the **minimal** or **kitchen-sink** template.

## Development (monorepo)

Run from **`packages/start`** only. The app is created at `packages/start/dist/<name>` and is a workspace package, so `@aero-ssg/*` deps resolve from the monorepo. The `dist/` directory is gitignored, so scaffolded apps are not committed.

```bash
cd packages/start
pnpm run create-aero my-app
pnpm run create-aero my-app --template kitchen-sink
```

Then:

```bash
cd dist/my-app
pnpm dev
```

Or from repo root:

```bash
pnpm --dir packages/start/dist/my-app dev
```

## Published usage

When `create-aero` is installed from npm:

```bash
pnpm create aero <dir> [--template minimal|kitchen-sink]
npm create aero@latest <dir> [--template minimal|kitchen-sink]
yarn create aero <dir> [--template minimal|kitchen-sink]
```

The app is created in the current directory (or the given path). The CLI rewrites `workspace:*` to `*` and runs `pnpm install` (or npm/yarn) in the new project.

## Arguments

| Argument   | Description                                                                 |
|-----------|-----------------------------------------------------------------------------|
| **&lt;dir&gt;** | App name and directory (e.g. `my-app` → `packages/start/dist/my-app` in monorepo). |
| **--template** | `minimal` (default) or `kitchen-sink`.                                      |

## Templates

| Template       | Description                                                                 |
|----------------|-----------------------------------------------------------------------------|
| **minimal**    | One layout, index + about, `site.ts` only. No server, no content collections, no Alpine/HTMX. |
| **kitchen-sink** | Full demo: pages, layouts, components, content collections, Nitro API, Alpine, HTMX.   |

Templates are provided by `@aero-ssg/template-minimal` and `@aero-ssg/template-kitchen-sink` (workspace or published).
