// @ts-nocheck

// @snippet:typescript
const _docs = defineCollection({
	// collection options...
	schema: z.object({
		// [!code highlight]
		published: z.boolean().default(false),
		// other fields...
	}),
})
