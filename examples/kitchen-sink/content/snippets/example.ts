// @ts-nocheck

// @snippet:drafts
const docs = defineCollection({
	// collection options...
	schema: z.object({
		// [!code highlight]
		published: z.boolean().default(false),
		// other fields...
	}),
})
