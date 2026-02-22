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

When the same component is used multiple times with different `pass:data`, each instance gets its own `<script type="application/json" class="__aero_data">` block immediately followed by its script tag. The script’s preamble reads from `document.currentScript.previousElementSibling` (and checks `type="application/json"` and `class="__aero_data"`), so each script uses the JSON block that directly precedes it. No single global `id` is used, so multiple instances do not clash.

---

## Next Steps for Implementation

1. **How `deduping` works with dynamic `pass:data`**
   - We must update the `pass:data` JSON bridge to handle multiple instances of the same component cleanly.
2. **Implicit `type="module"`**
   - When Aero extracts scripts to Vite (the default), it MUST inject `type="module"` when it writes the script tag to the final HTML document.
3. **Parse Everything**
   - Update `parser.ts` to capture _all_ `<script>` tags so they can enter the default bundling pipeline unless explicitly opted out (`is:inline`).
