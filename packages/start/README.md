# create-aero

Project initializer for [Aero](https://github.com/aero-ssg/aero). Run with:

```bash
pnpm create aero <dir> [--template minimal|kitchen-sink]
```

- **&lt;dir&gt;** — Target directory (e.g. `my-app`). Created if missing; must be empty if it exists.
- **--template** — `minimal` (default) or `kitchen-sink`. Omit for the minimal template.

## Examples

```bash
pnpm create aero my-app
pnpm create aero my-app --template minimal
pnpm create aero my-app --template kitchen-sink
```

After scaffolding, the CLI runs `pnpm install` (or `npm`/`yarn` if those lockfiles are present). Then:

```bash
cd my-app
pnpm dev
```

## Templates

- **minimal** — One layout, index + about, `site.ts` only. No server, no content collections, no Alpine/HTMX.
- **kitchen-sink** — Full demo app: pages, layouts, components, content collections, Nitro API, Alpine, HTMX. Used for development and feature testing.

Templates are provided by `@aero-ssg/template-minimal` and `@aero-ssg/template-kitchen-sink` (workspace or published).
