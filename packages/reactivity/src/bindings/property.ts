import { Effect } from '../effect'
import type { Cleanup } from '../mount'
import {
	isBooleanIdlPropertyForMirror,
	mirrorBooleanPresenceAttr,
	mirrorStringAttr,
	shouldMirrorContentAttribute,
} from './mirror-content-attribute'

export function bindProperty(
	target: Element,
	propertyName: string,
	read: () => unknown
): Cleanup {
	const contentAttribute = shouldMirrorContentAttribute(propertyName)
	const mirrorAsBoolean =
		contentAttribute != null && isBooleanIdlPropertyForMirror(propertyName)

	const effect = new Effect(() => {
		const value = read()
		;(target as unknown as Record<string, unknown>)[propertyName] = value
		if (contentAttribute == null) return
		if (mirrorAsBoolean) {
			mirrorBooleanPresenceAttr(target, contentAttribute, Boolean(value))
		} else {
			mirrorStringAttr(target, contentAttribute, value == null ? '' : String(value))
		}
	})
	return () => effect.destroy()
}
