# aero.js.org

Built with [Aero](https://github.com/jamiewilson/aero) — an HTML-first static site generator powered by Vite.

## Commands

| Command        | Description            |
| -------------- | ---------------------- |
| `pnpm dev`     | Start the dev server   |
| `pnpm build`   | Build for production   |
| `pnpm preview` | Preview the built site |

## Project Structure

```
./
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

## Learn More

- [Aero on GitHub](https://github.com/jamiewilson/aero)
- [@aero-js/core on npm](https://www.npmjs.com/package/@aero-js/core)
