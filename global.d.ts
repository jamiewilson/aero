declare global {
	interface ThemeStore {
		current: ThemeOptions
		set(): void
	}

	// TODO: How can this be used for props? Should Props be it's own type?
	interface Metadata {
		title?: string
		description?: string
		url?: string
		ogImage?: string
	}

	interface SubmitPost {
		message: string
	}

	interface String {
		capitalize(): string
	}
}

export {}
