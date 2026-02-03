/**
 * Capitalizes the first letter of each word in a string.
 * Example: "this is a test" -> "This Is A Test"
 */
export function capitalize(str: string): string {
	return str.toLowerCase().replace(/(?:^|\s)\w/g, match => {
		return match.toUpperCase()
	})
}
