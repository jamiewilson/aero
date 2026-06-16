export function* range(start: number, end: number): Iterable<number> {
	for (let i = start; i <= end; i++) {
		yield i
	}
}
