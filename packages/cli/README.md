# @aero-js/cli

Command-line tools for Aero: **`aero check`** (validate config, content collections, and templates without starting a server) and **`aero doctor`** (environment checklist).

## Install

```bash
pnpm add -D @aero-js/cli
```

## Usage

```bash
pnpm exec aero check
pnpm exec aero check --root /path/to/project
pnpm exec aero doctor
pnpm exec aero --help
```

## Documentation

Full behavior, exit codes, limitations, and related package APIs (**`loadAeroConfig`**, **`loadContentConfigFileSync`**, **`@aero-js/core/compile-check`**) are documented in the repo:

**[\_reference/aero-cli-and-check.md](../../_reference/aero-cli-and-check.md)**

Further CLI UX (e.g. **`@aero-js/create`** post-scaffold) is tracked in **[\_reference/plans/effect_implementation_phased_plan.md](../../_reference/plans/effect_implementation_phased_plan.md)**.
