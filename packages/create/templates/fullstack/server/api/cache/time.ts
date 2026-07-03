import { defineCachedHandler } from 'nitro/cache'

export default defineCachedHandler(
	() => ({
		cachedAt: new Date().toISOString(),
	}),
	{
		maxAge: 60,
		name: 'starter-time',
	}
)
