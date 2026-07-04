import type { NumericText, NumericTextOptions, Value } from '@numeric-text/core'

export interface WireNumericTextOptions {
	value: Value
	animated?: boolean
	trend?: NumericTextOptions['trend']
	transition?: NumericTextOptions['transition']
	respectMotionPreference?: boolean
	isMounted: () => boolean
}

/** Sync numeric-text element props to the custom element API (`.update()` / `.setOptions()`). */
export function wireNumericText(el: NumericText | null, options: WireNumericTextOptions): void {
	if (!el) return
	el.update(options.value, options.isMounted() && (options.animated ?? true))
	el.setOptions({
		trend: options.trend,
		transition: options.transition,
		respectMotionPreference: options.respectMotionPreference,
	})
}
