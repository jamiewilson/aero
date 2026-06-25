import { Effect } from '../effect'
import type { Cleanup } from '../mount'

export function bindProperty(
	target: Element,
	propertyName: string,
	read: () => unknown
): Cleanup {
	const effect = new Effect(() => {
		const value = read()
		;(target as unknown as Record<string, unknown>)[propertyName] = value
	})
	return () => effect.destroy()
}
