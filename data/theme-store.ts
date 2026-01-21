import type { Theme } from '~/data/theme'

export interface ThemeStore {
	current: Theme
	modes: Theme[]
	set(): void
}
