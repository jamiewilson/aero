---
title: Draft Doc
subtitle: This is a draft document. You can see it in dev mode, but it will not be included in the build.
---

Aero Content will filter out documents without the `published` field set to `true`. Your content collection config schema file (e.g. `content.config.ts`) must include this option:

```ts
const docs = defineCollection({
	// collection options...
	schema: z.object({
		// [!code highlight]
		published: z.boolean().default(false),
		// other fields...
	}),
})
```

Then in your document frontmatter, set `published: true` to include the document in the build.

```md
---
published: true
title: My Document
subtitle: This is a published document. You can see it in dev mode and in the build.
---
```

## Heading

Nam tincidunt congue enim, ut porta lorem lacinia consectetur.

Donec ut libero sed arcu vehicula ultricies a non tortor. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean ut gravida lorem.
