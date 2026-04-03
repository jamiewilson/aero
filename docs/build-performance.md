# Incremental static build

For production `vite build`, Aero can **skip or narrow** the static HTML prerender phase when a previous run left a compatible cache. This speeds up repeated builds when only some templates or assets change.

Opt in by setting a Node environment variable before the build:

| Value | Meaning |
| ----- | ------- |
| `AERO_INCREMENTAL=1` | Enable incremental behavior (also accepts `true` or `yes`, case-insensitive). |
| Unset or any other value | Full prerender every time (default). |

Example:

```bash
AERO_INCREMENTAL=1 pnpm build
```

The [kitchen-sink](https://github.com/jamiewilson/aero/tree/main/examples/kitchen-sink) example enables this on its `build` script.

## Where state is stored

Successful incremental builds write a JSON manifest:

- **Path:** `.aero/cache/build-manifest.json` (under the project root).

The manifest records fingerprints of the client template tree, the Vite output manifest, static build options, per-file template hashes, and which routes map to which output files. **Version** `2` adds `templateFileHashes` (sha256 per `*.html` under your client directory, e.g. `client/`). Older version-`1` manifests are still read but do not support partial prerender.

When incremental mode is on, the Vite **`build.emptyOutDir`** option is **disabled** so `dist/` is not wiped before each build; unchanged outputs can be reused.

## What can be skipped

Behavior depends on whether you use **dynamic** pages (`[param]` routes under `client/pages/`).

### No dynamic routes

1. **Whole prerender skip** — If the previous manifest exists and **all** of these match the current run, the static prerender step does nothing (no HTML rewrite):
   - Hash of `dist/.vite/manifest.json` (Vite/Rolldown client build graph).
   - Fingerprint of every `*.html` under the client directory (content + paths).
   - Hash of static build options Aero cares about (site URL string and redirects config).

2. **Partial prerender** — When the prerender phase runs, if the previous manifest includes `templateFileHashes` and this run’s **Vite output manifest hash** and **static build options hash** match those stored in that manifest, Aero may render **only** pages whose build-script **template dependency closure** intersects a **changed** `*.html` file (per hash diff). If no page depends on a changed template, that phase may write no HTML.

Set **`AERO_LOG=debug`** to print static prerender decisions and timings to the console (see also `AERO_STATIC_PRERENDER_CONCURRENCY` in the same build for bounded parallelism).

### Dynamic routes present

If **any** page is a dynamic route (`[slug].html` style), **whole-phase skip is disabled**: `getStaticPaths()` must run every build, so incremental mode does not skip the entire prerender step for that reason alone. Partial prerender within a run is also disabled in this case; the full prerender path runs.

## When to turn it off

Disable incremental builds when you need a completely clean `dist/` every time (for example, strict reproducibility checks or debugging stale output). Omit `AERO_INCREMENTAL` or run a clean build after removing `dist/` manually if needed.

## Related

- **[Aero CLI (`aero check`) and tooling APIs](aero-cli-and-check.md)** — `aero check --types` for CI type-checking (separate from incremental HTML prerender).
- **[Environment variables](environment-variables.md)** — Vite and `import.meta.env` (incremental flags are Node env for the build process, not `VITE_`).
