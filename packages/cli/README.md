# @aero-js/cli

Command-line tools for Aero: **`aero check`** (validate config, content collections, and templates without starting a server) and **`aero doctor`** (environment checklist).

## Install

```bash
pnpm add -D @aero-js/cli
```

## Usage

```bash
pnpm exec aero check
pnpm exec aero check --types
pnpm exec aero check --root /path/to/project
pnpm exec aero doctor
pnpm exec aero --help
```

## Documentation

Full behavior, exit codes, limitations, and related package APIs (**`loadAeroConfig`**, **`loadContentConfigFileSync`**, **`@aero-js/core/compile-check`**) are documented in the repo:

**[CLI documentation](../../docs/tooling/cli.mdx)**
