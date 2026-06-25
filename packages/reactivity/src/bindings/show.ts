import { Effect } from '../effect'
import type { Cleanup } from '../mount'

export function bindShow(
	target: HTMLElement,
	read: () => unknown,
	originalDisplay = target.style.display
): Cleanup {
	const effect = new Effect(() => {
		const visible = Boolean(read())
		target.style.display = visible ? originalDisplay : 'none'
	})
	return () => effect.destroy()
}
