import { Effect } from '../effect'
import type { Cleanup } from '../mount'

export function bindProperty(target: Element, propertyName: string, read: () => unknown): Cleanup {
	const bindAsAttribute =
		propertyName.startsWith('data-') ||
		propertyName.startsWith('aria-') ||
		propertyName.includes('-')
	const effect = new Effect(() => {
		const value = read()
		if (bindAsAttribute) {
			if (value == null || value === false) {
				target.removeAttribute(propertyName)
			} else {
				target.setAttribute(propertyName, String(value))
			}
			return
		}
		;(target as unknown as Record<string, unknown>)[propertyName] = value
	})
	return () => effect.destroy()
}
