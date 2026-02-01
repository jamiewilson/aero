import { ThemeMode } from '~/data/theme'

export type ThemeOptions = ThemeMode

export interface ThemeStore {
	current: ThemeOptions
	set(): void
}

export interface SubmitPost {
	message: string
}

export interface TbdOptions {
	resolvePath?: (specifier: string) => string
}

export interface MountOptions {
	target?: string | HTMLElement
	onRender?: (root: HTMLElement) => void
}

export interface RenderOptions {
	el?: HTMLElement
	onRender?: (root: HTMLElement) => void
}

export interface CompileOptions {
	root: string
	clientScriptUrl?: string
	resolvePath?: (specifier: string) => string
}

export interface ResolverOptions {
	root: string
	resolvePath?: (specifier: string) => string
}

export interface ParseResult {
	buildScript: { content: string } | null
	clientScript: { content: string } | null
	template: string
}

export interface UserAlias {
	find: string
	replacement: string
}

export interface AliasResult {
	aliases: UserAlias[]
	resolvePath?: (specifier: string) => string
}

export interface PageFragments {
	head: string
	body: string
}
