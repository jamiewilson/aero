---
name: Aero CLI and check tooling
overview: Documentation for @aero-js/cli (aero check), supporting package APIs, CI usage, and current limitations.
---

# Aero CLI (`aero check`) and tooling APIs

This document describes `@aero-js/cli`, the `aero check` command, the `aero doctor` command, and the supporting public APIs used by Aero tooling.

## Why `@aero-js/cli` is a separate package

`@aero-js/config` already depends on `@aero-js/core` for alias resolution helpers. Putting the CLI inside core and importing config loading from `@aero-js/config` would create a circular dependency. The CLI therefore lives in `packages/cli`, depends on `@aero-js/core`, `@aero-js/config`, and `@aero-js/content`, and publishes the `aero` binary.

## Installing and running

Add the CLI to your app:

```bash
pnpm add -D @aero-js/cli
```

Run from an app project root that has `@aero-js/cli` installed, or set `--root`:

```bash
pnpm exec aero check
pnpm exec aero check --root /path/to/project
pnpm exec aero doctor
pnpm exec aero doctor --root /path/to/project
pnpm exec aero --help
```

For local monorepo development after `pnpm build`, invoke the built CLI directly:

```bash
node packages/cli/dist/index.mjs check --root examples/kitchen-sink
node packages/cli/dist/index.mjs doctor --root examples/kitchen-sink
```

## `aero check`

`aero check` validates an Aero project without starting a dev server or running a full Vite build. It collects `AeroDiagnostic` entries with `severity: 'error'` and, if any remain, prints them with `formatDiagnosticsTerminal` using plain output on stderr and exits with a bucketed code from `exitCodeForDiagnostics`. Otherwise it exits `0`.

### Aero config

- `loadAeroConfig(root)` from `@aero-js/config` loads the first matching `aero.config.ts`, `.js`, or `.mjs` file in the project root using the same jiti plus path-alias behavior as Vite.
- If no config is found, or if `loadAeroConfig(root)` returns `null`, `aero check` continues with default `dirs` values from `resolveDirs`.
- If the config export is a function, it is called with `{ command: 'build', mode: 'production' }`.

Current limitation:
`runAeroCheck` uses `loadAeroConfig`, not the stricter Effect-based config loaders. If a config file exists but fails to load, `aero check` can still fall back to default `dirs` and potentially skip templates under a custom client directory such as `frontend/`. In that case, use `DEBUG=aero` or `vite build` for more detail.

Important:
`vite.config.ts` should import `createViteConfig` from `@aero-js/config/vite`, not the main `@aero-js/config` entry, so `aero.config.ts` can load via jiti without pulling Vite into the config entrypoint.

### Content collections

Content validation runs when any of these is true:

| Condition                                                                | Behavior                                                                                                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `aero.content === true`                                                  | Always run; if the resolved content config file is missing, `aero check` emits `AERO_CONFIG`.                                  |
| `aero.content` is an object such as `{ config: 'my-content.config.ts' }` | Always run; path defaults to `content.config.ts` or the configured path.                                                       |
| `content.config.ts` or the configured path exists on disk                | Run even if `content` is omitted in `aero.config`, so repos that only wire content via Vite still get schema validation in CI. |

Loading uses `loadContentConfigFileSync(root, configFile)` from `@aero-js/content`. On success:

1. `initProcessor(contentConfig.markdown)` runs.
2. `loadAllCollections(contentConfig, root)` runs.

- In lenient content mode, `aero check` still treats reported `schemaIssues` as error diagnostics via `contentSchemaIssuesToAeroDiagnostics(..., 'error')`.
- In strict mode, or when `AERO_CONTENT_STRICT=1`, `loadAllCollections` may throw, for example with `ContentSchemaAggregateError`; that error is then mapped through `unknownToAeroDiagnostics`.

### Template compilation

All `.html` files are discovered recursively under:

- `<root>/<client>/pages`
- `<root>/<client>/components`
- `<root>/<client>/layouts`

where `<client>` comes from `resolveDirs(aero.dirs).client`.

For each file, `compileTemplate(source, { root, resolvePath, importer })` runs. Path resolution uses `mergeWithDefaultAliases(loadTsconfigAliases(root), root, dirs)`, which matches the compiler and Vite pipeline.

This checks parse and codegen, including build-script analysis, but does not execute SSR, Nitro, or a full Vite build.

## `aero doctor`

`aero doctor` prints a short checklist for `--root` or the current working directory:

- Node.js version, failing with exit `1` if below the minimum supported version, currently `18`
- `vite` presence from `package.json`
- `@aero-js/core` or `@aero-js/vite` presence from `package.json`
- `@aero-js/cli` version
- A reminder about the Aero VS Code extension

Lines use `[ok]`, `[warn]`, `[info]`, or `[fail]`. Warnings still exit `0`.

## Exit codes and output

### `aero check`

On failure, the exit code is `exitCodeForDiagnostics(errors)` from `@aero-js/core/diagnostics`, using the same primary buckets as static prerender failures. Typical buckets are:

- `10` config
- `12` compile, resolve, or build-script
- `13` content schema
- `14` route

See `packages/diagnostics/src/exit-codes.ts` for the current mapping. `0` means no error-level diagnostics.

### `aero doctor`

| Exit code | Meaning                                                                     |
| --------- | --------------------------------------------------------------------------- |
| `0`       | Node meets the minimum; output may still include warnings or info messages. |
| `1`       | Node is below the CLI minimum.                                              |

## Public APIs for tooling

### `@aero-js/cli`

| Surface               | Description                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Binary `aero`         | Entry: `packages/cli/dist/index.mjs` with a Node shebang.                                                               |
| `runAeroCheck(root)`  | Implemented in `packages/cli/src/check.ts`. Consumed by the CLI binary and not currently exported as a package subpath. |
| `runAeroDoctor(root)` | Implemented in `packages/cli/src/doctor.ts`; returns `0` or `1`.                                                        |

### `@aero-js/config`

| Export                                                  | Description                                                                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `loadAeroConfig(root)`                                  | Loads `aero.config.{ts,js,mjs}` with jiti and `jitiAliasRecordFromProject(root)`. Returns `AeroConfig`, `AeroConfigFunction`, or `null`. |
| `loadAeroConfigEffect` and `loadAeroConfigStrictEffect` | Stricter Effect-based config loading surfaces for callers that want explicit failure handling.                                           |

### `@aero-js/content`

| Export                                                   | Description                                                                                                             |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `loadContentConfigFileSync(root, configFile)`            | Sync load of `content.config`. Returns `{ ok: true, config }` or `{ ok: false, reason: 'missing' or 'error', error? }`. |
| `loadAllCollections(config, root)`                       | Loads every collection; returns `{ loaded, schemaIssues }` and may throw in strict schema mode.                         |
| `loadAllCollectionsEffect(config, root)`                 | Effect-based counterpart for callers that want failure-channel composition.                                             |
| `contentSchemaIssuesToAeroDiagnostics(issues, severity)` | Maps schema issues to `AeroDiagnostic[]`.                                                                               |
| `LoadContentConfigResult`                                | Type for `loadContentConfigFileSync` results.                                                                           |

See [docs/content-api.md](content-api.md) for the broader content API.

### `@aero-js/core/compile-check`

| Export            | Description                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `compileTemplate` | Node-only compile entry for tooling so callers do not pull codegen through browser-oriented entrypoints. |

### `@aero-js/core/diagnostics`

Use `formatDiagnosticsTerminal`, `unknownToAeroDiagnostics`, `AeroDiagnostic`, and related helpers from `@aero-js/core/diagnostics` or `@aero-js/diagnostics`. `aero check` uses the same diagnostics contract as the other tooling and dev surfaces.

## CI example

```yaml
- run: pnpm install
- run: pnpm exec aero check
```

Use `--root` when the job’s working directory is not the app root.

## Related docs

- [docs/content-api.md](content-api.md)
- [packages/cli/README.md](../packages/cli/README.md)
