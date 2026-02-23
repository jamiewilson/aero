# Site URL (canonical origin)

Aero can be configured with a **canonical site URL** (e.g. `https://example.com`). This value is used for absolute URLs in sitemaps, RSS feeds, canonical links, and Open Graph tags.

## Configuration

**With `@aero-ssg/config` (aero.config.ts):**

```ts
import { defineConfig } from '@aero-ssg/config'

export default defineConfig({
  content: true,
  server: true,
  site: 'https://example.com',
})
```

**With the Vite plugin directly:**

```ts
import { aero } from '@aero-ssg/core/vite'

export default {
  plugins: [aero({ nitro: true, site: 'https://example.com' })],
}
```

- If omitted, `site` is an empty string. Set it when you need absolute URLs (e.g. for SEO or RSS).

## Where it appears

| Context | How to use it |
|--------|----------------|
| **Build scripts / templates** | `Aero.site` — the canonical URL string (e.g. in `<link rel="canonical">` or meta tags). |
| **Build-time JS (Vite)** | `import.meta.env.SITE` — replaced at build time by the plugin. |

Example in a layout:

```html
<script is:build>
  const base = Aero.site || ''
</script>
<link rel="canonical" href="{ base }{ Aero.url.pathname }" />
```

Or with a trailing slash and pathname:

```html
<meta property="og:url" content="{ Aero.site }{ Aero.url.pathname }" />
```

## Notes

- The **content global** `site` (from `src/content/site.ts` or similar) is separate: it holds your app’s content (title, nav, etc.). The **config** `site` is only the origin URL.
- Future sitemap and RSS features will use this value to build absolute URLs.
