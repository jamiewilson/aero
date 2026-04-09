# Standalone runtime

## The problem

Sometimes you want Aero templating outside a full Aero app + Vite runtime. Common examples:

- rendering HTML in scripts/tools,
- generating email-like output from Aero templates,
- using Aero templates in a Node ESM service without booting Vite.

Without a dedicated entrypoint, users have to stitch compiler output, module loading, and runtime rendering together manually.

## What this looks like without Aero helpers

You compile template source, then still need to load generated module code, bridge imports, and feed it into the runtime context yourself.

## How Aero helps

`@aero-js/core/runtime/standalone` provides an ESM-first execution bridge and one-shot render helper:

- `loadCompiledTemplateModule(...)`
- `renderTemplate(...)`

These helpers keep the same template contract but avoid requiring the full dev server flow.

## Using standalone runtime

## What to import

```ts
import { loadCompiledTemplateModule, renderTemplate } from '@aero-js/core/runtime/standalone'
import { compileTemplate } from '@aero-js/compiler'
```

## One-shot rendering

Use `renderTemplate(...)` when you have HTML source and want rendered output directly.

```ts
import { renderTemplate } from '@aero-js/core/runtime/standalone'

const html = await renderTemplate({
	templateSource: `<h1>{ title }</h1>`,
	root: process.cwd(),
	importer: '/virtual/example.html',
	input: { props: { title: 'Hello' } },
})
```

### Options

- `templateSource` (required): HTML template source
- `root` (required): project root for import resolution
- `importer` (required): virtual/real source path used as importer for relative imports
- `resolvePath` (optional): alias/path resolver `(specifier, importer) => string`
- `globals` (optional): values registered via `Aero.global(name, value)`
- `input` (optional): forwarded to `Aero.render(...)`

## Load precompiled module source

Use `loadCompiledTemplateModule(...)` when compilation and execution are separate steps.

```ts
import { compileTemplate } from '@aero-js/compiler'
import { loadCompiledTemplateModule } from '@aero-js/core/runtime/standalone'

const source = `<p>{ message }</p>`
const compiledSource = compileTemplate(source, {
	root: process.cwd(),
	importer: '/virtual/message.html',
})

const pageModule = await loadCompiledTemplateModule({
	compiledSource,
	root: process.cwd(),
	importer: '/virtual/message.html',
})
```

`pageModule` can then be registered/rendered through the runtime in advanced flows.

## Boundaries and constraints

- Standalone helpers are currently **ESM-first**.
- `root` + `importer` are required; these are needed for import resolution.
- Bundled client-script workflows still belong to the normal Aero + Vite path.
- For normal app runtime, keep using standard Aero entrypoints; standalone is for out-of-band execution flows.

## Related docs

- [Monorepo guide](monorepo.md)
- [Script taxonomy](script-taxonomy.md)
- [Interpolation](interpolation.md)
