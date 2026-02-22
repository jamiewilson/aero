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

---

## Next Steps for Implementation

1. **How `deduping` works with dynamic `pass:data`**
   - We must update the `pass:data` JSON bridge to handle multiple instances of the same component cleanly.
2. **Implicit `type="module"`**
   - When Aero extracts scripts to Vite (the default), it MUST inject `type="module"` when it writes the script tag to the final HTML document.
3. **Parse Everything**
   - Update `parser.ts` to capture _all_ `<script>` tags so they can enter the default bundling pipeline unless explicitly opted out (`is:inline`).
