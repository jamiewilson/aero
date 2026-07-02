export function createID() {
	return crypto.randomUUID().split('-').pop()
}

export function getRandomIndex(items: any[]) {
	return Math.floor(Math.random() * items.length)
}

export function allCaps(str: string) {
	return str.toUpperCase()
}

export function withTransition(update: () => void) {
	return document.startViewTransition ?
			document.startViewTransition(update)
		:	update()
}
