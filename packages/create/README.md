# @aero-js/create

Vite+ template manifest for new [Aero](https://github.com/jamiewilson/aero) projects. Starters live under **`templates/`** (**minimal**, **fullstack**).

## Usage

Install [Vite+](https://viteplus.dev/guide/) (`vp`), then:

```bash
vp create @aero-js:minimal --directory my-app --no-interactive
cd my-app && pnpm install && vp dev
```

Fullstack (Nitro + `server/`):

```bash
vp create @aero-js:fullstack --directory my-app --no-interactive
```

List templates:

```bash
vp create @aero-js --no-interactive
```

**Local / unpublished manifest:** `vp create @aero-js:*` reads **`createConfig`** from the npm registry packument. After changing templates, publish **`@aero-js/create`**, or smoke-copy locally:

```bash
node scripts/smoke-template-build.mjs minimal
```

## Templates

| Name          | Description                                                                   |
| ------------- | ----------------------------------------------------------------------------- |
| **minimal**   | Static site — `client/`, `content/site.ts`, no `server/`                      |
| **fullstack** | Static + Nitro — `server/`, `nitro.config.ts`, `vp build` + `.output/` server |

## Links

- [GitHub](https://github.com/jamiewilson/aero)
- [@aero-js/core on npm](https://www.npmjs.com/package/@aero-js/core)
- [Vite+ create guide](https://viteplus.dev/guide/create)

## License

MIT
