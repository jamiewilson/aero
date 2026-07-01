import { Effect } from '../effect'
import type { Cleanup } from '../mount'
import { applyAttributeCoercion } from './coerce-attribute-value'

export function bindAttribute(
	target: Element,
	name: string,
	read: () => unknown
): Cleanup {
	const effect = new Effect(() => {
		applyAttributeCoercion(target, name, read())
	})
	return () => effect.destroy()
}
