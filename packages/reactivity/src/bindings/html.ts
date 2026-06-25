import { Effect } from '../effect'
import type { Cleanup } from '../mount'

export function bindHtml(target: Element, read: () => unknown): Cleanup {
	const effect = new Effect(() => {
		const value = read()
		target.innerHTML = value == null ? '' : String(value)
	})
	return () => effect.destroy()
}
