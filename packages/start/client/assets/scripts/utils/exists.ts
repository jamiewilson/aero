// Check if a value exists (is not null or undefined)

export function exists<T>(value: T | null | undefined): value is T {
	return typeof value !== undefined && value !== null
}
