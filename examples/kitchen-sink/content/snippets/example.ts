// @ts-nocheck

// @snippet:typescript
const docs = defineCollection({
	// collection options...
	schema: z.object({
		// [!code highlight]
		published: z.boolean().default(false),
		// other fields...
	}),
})
