# Site URL (canonical origin)

Aero can be configured with a **canonical site URL** (e.g. `https://example.com`). This value is used for absolute URLs in sitemaps, RSS feeds, canonical links, and Open Graph tags.

## Configuration

**With `@aerobuilt/config` (aero.config.ts):**

```ts
import { defineConfig } from 'aerobuilt/config'

export default defineConfig({
	content: true,
	server: true,
	site: 'https://example.com',
})
```

**With the Vite plugin directly:**

```ts
import { aero } from 'aerobuilt/vite'

export default {
	plugins: [aero({ nitro: true, site: 'https://example.com' })],
}
```

- If omitted, `site` is an empty string. Set it when you need absolute URLs (e.g. for SEO or RSS).

## Where it appears

| Context                       | How to use it                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Build scripts / templates** | `Aero.site` — the canonical URL string (e.g. in `<link rel="canonical">` or meta tags).                                                         |
| **Build-time JS (Vite)**      | `import.meta.env.SITE` — replaced at build time by the plugin. See [Environment variables](environment-variables.md) for `.env` and TypeScript. |

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

## Sitemap

When `site` is set, the static build generates **`sitemap.xml`** in the output directory (`dist/`). It lists all pre-rendered routes (static and expanded dynamic) as absolute URLs; the 404 page is excluded. No extra config is required.

To help crawlers and tools discover the sitemap, link to it from your layout (e.g. in `<head>`):

```html
<script is:build>
	const base = Aero.site || ''
</script>
<!-- ... other head content ... -->
<link rel="sitemap" type="application/xml" href="{ base }/sitemap.xml" />
```

If you only want the sitemap link when `site` is set (e.g. to avoid a broken link in local dev), wrap it with `if`:

```html
<link
	rel="sitemap"
	type="application/xml"
	href="{ Aero.site }/sitemap.xml"
	if="{ Aero.site }" />
```

## Notes

- The **content global** `site` (from your content module, e.g. `content/site.ts` or `@content/site`) is separate: it holds your app’s content (title, nav, etc.). The **config** `site` is only the canonical origin URL.
- RSS and other features can use `Aero.site` or `import.meta.env.SITE` to build absolute URLs.
