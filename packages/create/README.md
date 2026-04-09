# @aero-js/create

Scaffold a new [Aero](https://github.com/jamiewilson/aero) project. Aero is an HTML-first static site generator powered by Vite, with optional Nitro support for APIs and server features.

## Usage

```bash
pnpm create @aero-js my-app
cd my-app
pnpm dev
```

Also works with npm, yarn, and `pnpm dlx`:

```bash
npx @aero-js/create@latest my-app
yarn create @aero-js my-app
pnpm dlx @aero-js/create@latest my-app
```

## Options

| Argument            | Description                                                                              | Default      |
| ------------------- | ---------------------------------------------------------------------------------------- | ------------ |
| `<dir>`             | Project name and directory                                                               | _(required)_ |
| `--template <name>` | Starter template (`minimal`, `fullstack`)                                                | `minimal`    |
| `--strict`          | Run post-scaffold checks (`aero doctor`, `aero check`, best-effort `aero check --types`) | off          |

## What it does

1. Copies the selected template into a new directory
2. Rewrites `package.json` with your project name
3. Auto-detects your package manager (pnpm > yarn > npm) and installs dependencies
4. Prints next steps
5. With `--strict`, runs `aero doctor`, `aero check`, and a best-effort `aero check --types`

The `fullstack` template also adds `@aero-js/config`, `nitro`, a root `nitro.config.ts`, and a `preview:api` command.

## Project structure

```
my-app/
├── client/
│   ├── assets/         # Styles, scripts, images
│   ├── components/     # Reusable .html components
│   ├── layouts/        # Layout wrappers with <slot>
│   └── pages/          # File-based routing
├── content/
│   └── site.ts         # Global site data
├── public/             # Static assets (copied as-is)
├── vite.config.ts      # Aero Vite plugin
└── tsconfig.json       # Path aliases
```

If you change `dirs.client` (or other dirs) in `vite.config.ts` or `aero.config.ts`, update your `tsconfig.json` `paths` so they match (e.g. `@pages` → `"<client>/pages"`). The dev server will warn when custom dirs are used and a tsconfig is present.

## Links

- [GitHub](https://github.com/jamiewilson/aero)
- [@aero-js/core on npm](https://www.npmjs.com/package/@aero-js/core)

## License

MIT
