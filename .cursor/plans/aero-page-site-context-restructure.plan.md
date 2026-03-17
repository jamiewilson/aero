---
name: Aero.page and Aero.site restructure
overview: Remove top-level url, request, params from the template context and expose them via Aero.page.*. Convert Aero.site from a string to an object with Aero.site.url as the canonical URL, enabling future site-wide properties.
todos: []
isProject: false
---

# Aero.page and Aero.site Context Restructure

## Summary

Restructure the Aero template context to:

1. **Remove top-level `url`, `request`, `params`** — expose only via `Aero.page.url`, `Aero.page.request`, `Aero.page.params`
2. **Convert `Aero.site` from string to object** — `Aero.site.url` is the canonical site URL; structure allows future properties (e.g. `Aero.site.title`, `Aero.site.description`)

This eliminates naming collisions (users can declare `const url = Aero.site.url`), clarifies page vs. site scope, and future-proofs site-wide config.

---

## New Context Shape

### Before (current)

```ts
{
  props: Record<string, any>
  slots: Record<string, string>
  request: Request
  url: URL
  params: AeroRouteParams
  site: string
  styles?: Set<string>
  scripts?: Set<string>
  headScripts?: Set<string>
  renderComponent: ...
}
```

### After (proposed)

```ts
{
  props: Record<string, string>
  slots: Record<string, string>
  page: {
    url: URL
    request: Request
    params: AeroRouteParams
  }
  site: {
    url: string
    // Future: title?, description?, etc.
  }
  styles?: Set<string>
  scripts?: Set<string>
  headScripts?: Set<string>
  renderComponent: ...
}
```

---

## Usage

| Use case                       | Before                              | After                                      |
| ------------------------------ | ----------------------------------- | ------------------------------------------ |
| Request URL (canonical/og:url) | `{ url }` or `{ Aero.url }`         | `{ Aero.page.url }`                        |
| Request URL as string          | `{ url.href }`                      | `{ Aero.page.url.href }`                   |
| Route params                   | `{ params.slug }`                   | `{ Aero.page.params.slug }`                |
| Canonical site URL             | `{ Aero.site }`                     | `{ Aero.site.url }`                        |
| Site URL + path                | `Aero.site + '/path'`               | `Aero.site.url + '/path'`                  |
| Custom URL variable            | `const url = Aero.site` (collision) | `const url = Aero.site.url` (no collision) |

---

## Implementation Plan

### 1. Types (packages/core/src/types.ts)

- `AeroTemplateContext`: Remove `url`, `request`, `params`; add `page: { url, request, params }`; change `site` from `string` to `{ url: string }`
- `AeroRenderInput`: Add `page?: { url?, request?, params? }`; change `site` to `site?: string | { url: string }` (accept string for backward compat, normalize to object)
- `AeroRequestContext`: `site` stays as string for middleware (canonical URL)

### 2. Runtime (packages/core/src/runtime/index.ts)

- `createContext`: Build `page: { url, request, params }` and `site: { url: input.site ?? '' }`. Remove top-level `url`, `request`, `params`, `site` (string).
- `renderComponent`: Pass `page` and `site` in the input object when calling `createContext`.

### 3. Compiler (packages/core)

**helpers.ts**

- Remove `url`, `request`, `params` from `RENDER_DESTRUCTURE_PAIRS` and `RENDER_COMPONENT_CONTEXT_PAIRS`
- Remove `getRenderContextLetBindings`
- Add `page` and `site` to destructuring (or destructure from Aero directly since they're no longer flat)
- `getRenderComponentContextArg`: Pass `page` and `site` objects instead of `request`, `url`, `params`, `site`

**Interpolation**

- When template has `{ url }`, `{ request }`, or `{ params }`: compile to `Aero.page.url`, `Aero.page.request`, `Aero.page.params` (migration aid for common shorthand)
- Otherwise: no special handling; users use `{ Aero.page.url }` etc.
- When template has `{ site }` (bare): compile to `Aero.site.url` for backward compat, or document that `site` is now `Aero.site` (object) and use `Aero.site.url`

**Decision:** For `{ url }` shorthand, we have two options:

- (A) Map `{ url }` → `Aero.page.url` for convenience; document that `url` is reserved for this
- (B) No shorthand; require `{ Aero.page.url }` everywhere

Recommend (A) for migration; `url` is never a variable in scope, so no collision. Same for `{ request }` → `Aero.page.request`, `{ params }` → `Aero.page.params`. Do **not** add shorthand for `{ site }` — that typically refers to the content global from `@content/site`, not `Aero.site`.

### 4. Vite / build (packages/core/src/vite)

- `site` option stays as string in config
- When passing to `createContext` / render input: pass `site` string; runtime wraps as `{ url: site }`
- `writeSitemap`: still receives `site` as string (unchanged)
- `import.meta.env.SITE`: unchanged (string)

### 5. VS Code (packages/vscode)

- `ALLOWED_GLOBALS` or analyzer: ensure `Aero` and its properties (`Aero.page`, `Aero.site`) are recognized
- No `url`, `request`, `params` as globals anymore

### 6. Migrations

**Files to update**

- `website/client/components/meta.html`: `Aero.site` → `Aero.site.url`; `Aero.site + path` → `Aero.site.url + path`
- `examples/kitchen-sink/frontend/components/meta.html`: same
- `packages/core/src/compiler/__tests__/codegen.test.ts`: update context shape in tests
- `packages/core/src/compiler/emit.ts`: `getRenderComponentContextArg` usage
- Documentation: overview.md, README, site-url docs

---

## Implications of Changes

### Breaking changes

| Change                 | Impact                                      | Migration                                        |
| ---------------------- | ------------------------------------------- | ------------------------------------------------ |
| `Aero.site` is object  | `Aero.site` was string; now `Aero.site.url` | Replace `Aero.site` with `Aero.site.url`         |
| `Aero.url` removed     | Was request URL                             | Use `Aero.page.url`                              |
| `Aero.request` removed | Was Request object                          | Use `Aero.page.request`                          |
| `Aero.params` removed  | Was route params                            | Use `Aero.page.params`                           |
| `{ url }` in template  | No longer in scope                          | Use `{ Aero.page.url }` or add shorthand mapping |
| `{ site }` in template | No longer in scope (if it existed)          | Use `{ Aero.site.url }`                          |

### Content `site` vs. Aero.site

- **Content `site`** (from `@content/site`): Unchanged. This is a content global (e.g. `site.meta.title`, `site.theme`). It is separate from `Aero.site` and remains a user-defined object.
- **Aero.site**: Framework config (canonical URL from `aero.config`). Becomes `Aero.site.url` for the URL; object allows future config. No naming conflict: content uses `site`, framework uses `Aero.site`.

### Config `site` option

- `aero.config.ts` and `aero({ site: 'https://...' })` keep `site` as a string.
- Only the template context changes: runtime wraps it as `site: { url: site }`.

### import.meta.env.SITE

- Unchanged. Still a string at build time.
- `Aero.site.url` and `import.meta.env.SITE` will match when `site` is set in config.

### renderComponent context

- Child components receive `Aero` with `page` and `site` objects.
- `getRenderComponentContextArg()` emits `{ page, site, styles, scripts, headScripts }` instead of `{ request, url, params, site, ... }`.

### Middleware

- `AeroRequestContext` keeps `site` as string (canonical URL).
- Middleware continues to receive the same shape.

### Sitemap / RSS

- `writeSitemap` and any RSS generation use `site` as string; no change to those call sites.

### Future extensibility

**Aero.site** (object) can later include:

- `Aero.site.url` — canonical URL (required)
- `Aero.site.title` — from config or content
- `Aero.site.description` — from config or content
- Other site-wide metadata as needed

**Aero.page** (object) could later include:

- `Aero.page.url` — request URL
- `Aero.page.request` — Request object
- `Aero.page.params` — route params
- `Aero.page.path` — route path pattern (if desired)

---

## Files to Modify

| File                                                   | Changes                                                                       |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `packages/core/src/types.ts`                           | AeroTemplateContext, AeroRenderInput: page/site shape                         |
| `packages/core/src/runtime/index.ts`                   | createContext: build page, site objects                                       |
| `packages/core/src/compiler/helpers.ts`                | RENDER_COMPONENT_CONTEXT_PAIRS, RENDER_DESTRUCTURE_PAIRS, remove let bindings |
| `packages/core/src/compiler/emit.ts`                   | getRenderComponentContextArg usage                                            |
| `packages/core/src/compiler/codegen.ts`                | Any direct references to url/request/params                                   |
| `packages/core/src/compiler/__tests__/codegen.test.ts` | Update test context                                                           |
| `website/client/components/meta.html`                  | Aero.site → Aero.site.url                                                     |
| `examples/kitchen-sink/frontend/components/meta.html`  | Same                                                                          |
| `website/content/docs/*.md`                            | Document new API                                                              |
| `README.md`                                            | Document new API                                                              |
| `packages/vscode/src/diagnostics.ts`                   | If needed for Aero.page, Aero.site                                            |

---

## Testing

- Run `pnpm test`; fix any failing tests
- Add tests for `Aero.page.url`, `Aero.page.params`, `Aero.site.url`
- Verify meta.html, sitemap, RSS still work
- Manual: dev server, build, preview
