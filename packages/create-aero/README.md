# create-aero

Scaffold a new [Aero](https://github.com/aerobuilt/aero) project. Aero is an HTML-first static site generator powered by Vite.

## Usage

```bash
pnpm create aero my-app
cd my-app
pnpm dev
```

Also works with npm, yarn, and `pnpm dlx`:

```bash
npx create-aero@latest my-app
yarn create aero my-app
pnpm dlx create-aero my-app
```

## Options

| Argument | Description                | Default      |
| -------- | -------------------------- | ------------ |
| `<dir>`  | Project name and directory | _(required)_ |

## What it does

1. Copies the minimal template into a new directory
2. Rewrites `package.json` with your project name
3. Auto-detects your package manager (pnpm > yarn > npm) and installs dependencies
4. Prints next steps

After scaffolding, the project has `aerobuilt` as its only framework dependency.

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

## Links

- [GitHub](https://github.com/aerobuilt/aero)
- [aerobuilt on npm](https://www.npmjs.com/package/aerobuilt)

## License

MIT
