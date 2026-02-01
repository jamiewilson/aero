## Nitro Server Features

### File-Based Routing

Nitro automatically maps files to routes:

```
server/
├── api/
│   ├── hello.ts          → GET /api/hello
│   ├── users/
│   │   ├── index.ts      → GET /api/users
│   │   ├── [id].ts       → GET /api/users/:id
│   │   └── [id].delete.ts→ DELETE /api/users/:id
│   └── posts/
│       └── [...slug].ts  → GET /api/posts/* (catch-all)
├── routes/
│   ├── index.ts          → GET /
│   └── about.ts          → GET /about
└── middleware/
    └── auth.ts           → Runs on all requests
```

### Request Handlers

```typescript
// server/api/users/[id].ts
import { defineHandler, getRouterParam, createError } from 'nitro/h3'

export default defineHandler(event => {
	const id = getRouterParam(event, 'id')

	if (!id) {
		throw createError({
			statusCode: 400,
			message: 'User ID is required',
		})
	}

	return { id, name: `User ${id}` }
})
```

### Middleware

```typescript
// server/middleware/auth.ts
import { defineHandler, getHeader } from 'nitro/h3'

export default defineHandler(event => {
	const token = getHeader(event, 'authorization')

	// Add user to context (available in all handlers)
	event.context.user = token ? { authenticated: true } : null

	// Don't return anything - middleware should pass through
})
```

---

## Nitro KV Storage

Nitro provides a built-in key-value storage layer powered by [unstorage](https://unstorage.unjs.io/).

### Basic Usage

```typescript
// server/api/kv/[key].ts
import { defineHandler, getRouterParam, readBody } from 'nitro/h3'
import { useStorage } from 'nitro/storage'

// GET - retrieve value
export default defineHandler(async event => {
	const key = getRouterParam(event, 'key')
	const storage = useStorage('data') // Uses .data/kv directory

	const value = await storage.get(key)
	return { key, value }
})
```

```typescript
// server/api/kv/[key].post.ts
import { defineHandler, getRouterParam, readBody } from 'nitro/h3'
import { useStorage } from 'nitro/storage'

// POST - set value
export default defineHandler(async event => {
	const key = getRouterParam(event, 'key')
	const body = await readBody(event)
	const storage = useStorage('data')

	await storage.set(key, body.value)
	return { success: true, key }
})
```

### Storage Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { nitro } from 'nitro/vite'

export default defineConfig({
	plugins: [nitro()],
	nitro: {
		serverDir: './server',
		storage: {
			// Mount Redis for production
			redis: {
				driver: 'redis',
				host: 'localhost',
				port: 6379,
			},
			// Filesystem storage
			fs: {
				driver: 'fs',
				base: './.data/storage',
			},
		},
		// Different storage for development
		devStorage: {
			redis: {
				driver: 'fs',
				base: './.data/redis',
			},
		},
	},
})
```

### Storage Methods

```typescript
import { useStorage } from 'nitro/storage'

const storage = useStorage('data')

// Basic operations
await storage.get('key') // Get value
await storage.set('key', value) // Set value
await storage.has('key') // Check existence
await storage.remove('key') // Delete key
await storage.clear() // Clear all

// List keys
const keys = await storage.getKeys() // Get all keys
const keys = await storage.getKeys('user:') // Get keys with prefix
```

---

## Nitro SQL Database

Nitro includes an experimental built-in SQL database layer powered by [db0](https://db0.unjs.io/).

### Enable Database

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { nitro } from 'nitro/vite'

export default defineConfig({
	plugins: [nitro()],
	nitro: {
		serverDir: './server',
		experimental: {
			database: true,
		},
		// Optional: configure database connections
		database: {
			default: {
				connector: 'sqlite',
				options: { name: 'db' }, // Creates .data/db.sqlite
			},
			// Additional connections
			// users: {
			//   connector: 'postgresql',
			//   options: {
			//     url: 'postgresql://user:pass@host:5432/db'
			//   }
			// }
		},
	},
})
```

### Basic Usage

```typescript
// server/api/users/index.ts
import { defineHandler } from 'nitro/h3'
import { useDatabase } from 'nitro/database'

export default defineHandler(async () => {
	const db = useDatabase()

	// Create table (if needed)
	await db.sql`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			email TEXT UNIQUE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`

	// Query users
	const { rows } = await db.sql`SELECT * FROM users ORDER BY created_at DESC`

	return rows
})
```

```typescript
// server/api/users/index.post.ts
import { defineHandler, readBody } from 'nitro/h3'
import { useDatabase } from 'nitro/database'

export default defineHandler(async event => {
	const body = await readBody(event)
	const db = useDatabase()

	const id = crypto.randomUUID()

	await db.sql`
		INSERT INTO users (id, name, email)
		VALUES (${id}, ${body.name}, ${body.email})
	`

	return { id, ...body }
})
```

```typescript
// server/api/users/[id].ts
import { defineHandler, getRouterParam } from 'nitro/h3'
import { useDatabase } from 'nitro/database'

export default defineHandler(async event => {
	const id = getRouterParam(event, 'id')
	const db = useDatabase()

	const { rows } = await db.sql`SELECT * FROM users WHERE id = ${id}`

	return rows[0] || null
})
```
