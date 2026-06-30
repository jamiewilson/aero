export enum ThemeMode {
	System = 'system',
	Light = 'light',
	Dark = 'dark',
}

/** Shared contract for layout + toggle theme state. */
export interface ThemeStore {
	theme: ThemeMode
	cycleTheme(): void
}
