export enum ThemeMode {
	System = 'system',
	Light = 'light',
	Dark = 'dark',
}

export interface ThemeStore {
	current: ThemeMode
	set(): void
}
