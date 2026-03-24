/** Replace JS comments with spaces to preserve character indices for range calculations. */
export function maskJsComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, match => ' '.repeat(match.length))
}

export function isInsideHtmlComment(text: string, position: number): boolean {
	const commentRegex = /<!--[\s\S]*?-->/g
	let match: RegExpExecArray | null
	commentRegex.lastIndex = 0
	while ((match = commentRegex.exec(text)) !== null) {
		if (position >= match.index && position < match.index + match[0].length) {
			return true
		}
	}
	return false
}
