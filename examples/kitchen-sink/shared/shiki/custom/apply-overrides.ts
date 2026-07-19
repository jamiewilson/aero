import type { ThemeRegistrationAny } from 'shiki'

/**
 * @remarks
 * - Apply the overrides to the theme.
 */

export function applyOverrides(
	base: unknown,
	...overrides: Array<(theme: ThemeRegistrationAny) => ThemeRegistrationAny>
): ThemeRegistrationAny {
	return overrides.reduce((acc, fn) => fn(acc), base as ThemeRegistrationAny)
}
