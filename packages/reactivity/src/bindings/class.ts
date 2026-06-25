import { Effect } from '../effect'
import type { Cleanup } from '../mount'

export function bindClassToggle(
	target: Element,
	className: string,
	read: () => unknown
): Cleanup {
	const effect = new Effect(() => {
		target.classList.toggle(className, Boolean(read()))
	})
	return () => effect.destroy()
}
