export const AuthState = {
	Initializing: 'Initializing',
	Registering: 'Registering',
	Authenticating: 'Authenticating',
	SignedIn: 'SignedIn',
	SignedOut: 'SignedOut',
} as const

export type AuthState = (typeof AuthState)[keyof typeof AuthState]
