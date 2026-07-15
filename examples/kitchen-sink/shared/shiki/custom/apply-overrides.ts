import type { ThemeRegistrationAny } from 'shiki'

export function applyOverrides(
	base: unknown,
	...overrides: Array<(theme: ThemeRegistrationAny) => ThemeRegistrationAny>
): ThemeRegistrationAny {
	return overrides.reduce((acc, fn) => fn(acc), base as ThemeRegistrationAny)
}
