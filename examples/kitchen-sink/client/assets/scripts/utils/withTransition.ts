export function withTransition(update: () => void) {
	if (document.startViewTransition) {
		document.startViewTransition(update)
	} else {
		update()
	}
}
