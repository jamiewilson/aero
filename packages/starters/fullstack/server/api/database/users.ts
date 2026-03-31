import { defineHandler } from 'nitro/h3'
import { useDatabase } from 'nitro/database'

export default defineHandler(async () => {
	const db = useDatabase()

	await db.sql`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`

	const id = crypto.randomUUID()
	await db.sql`INSERT INTO users (id, name) VALUES (${id}, ${'Aero User'})`

	const { rows } = await db.sql`SELECT * FROM users ORDER BY created_at DESC LIMIT 5`
	return rows
})
