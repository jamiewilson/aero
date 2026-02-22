# Script logic and syntax

Syntax overview:

- `is:build` - only at build time
- `is:inline` - inline script
- `is:blocking` - hoisted to head
- ~~`is:bundled`~~ - Removed, becomes default behavior

## Default behavior for `<script>`:

- bundled
- hoisted to end of body
- deduped
- type=module
- maintains standard attributes (async, defer, etc.)

## Special behavior:

`type="*"`:

- standard JS behavior

`is:inline`:

- not hoisted
- not bundled
- not deduped
- not module

`is:inline type="module"`:

- not hoisted
- not bundled
- not deduped
- type=module

`is:blocking`:

- hoisted to head (could use blocking=render in the future?)
- ignores/warns contradictory attributes (type=module, async, defer, etc.)

`src="https://*"`:

- not bundled

`is:inline src="https://*"`:

- not bundled
- not hoisted

## Scripts with `src` (local vs external)

**External URLs** (`src="https://..."`) are never bundled; the tag stays in the template as-is.

**Local scripts** (`src="@scripts/..."`, `src="./..."`, etc.):

- Stay in the template (not extracted into the virtual client pipeline).
- Parser adds `type="module"` when missing so Vite can transform them.
- At build time, local `script[src]` and `link[href]` are discovered from source HTML, resolved via your path aliases, and added as Rollup entry points. They are bundled and get hashed filenames.
- The compiled HTML emits a root-relative `src` (e.g. `/client/assets/scripts/foo.ts`). During static build, that URL is rewritten to the hashed asset path (e.g. `./assets/foo.ts-abc123.js`) using the manifest.

So local `script[src]` uses the **asset pipeline** (discover → bundle → rewrite), not the **virtual client script** pipeline (extract → virtual module → one script tag per template). Deduping and ordering are per file, not merged with inline client scripts.

## pass:data and multiple instances

When the same component is used multiple times with different `pass:data`, each instance gets a unique id and three consecutive elements: (1) `<script type="application/json" id="__aero_0" class="__aero_data">…</script>`, (2) an inline script that sets `window.__aero_data_next` from that JSON and then runs immediately, (3) the module script tag. Bundled module scripts run deferred, so `document.currentScript` is null when they execute. The preamble in the bundled script therefore reads from `window.__aero_data_next` (set by the inline bridge) and then deletes it, so each instance’s module sees the correct data and multiple instances do not clash.

---

## Implementation notes

- **Implicit `type="module"`**: Default (bundled) client scripts and local `script[src]` get `type="module"` when missing. `defer` is stripped when adding `type="module"` (modules are deferred by default) to avoid redundant `defer="defer"` in output.
- **Parser**: Script removal and attribute edits are done by character range so comments and whitespace are preserved; scripts inside HTML comments are skipped.
