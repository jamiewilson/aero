import path from 'path'
import type { ResolverOptions } from '@src/types'

export class Resolver {
	private root: string
	private resolvePathFn: (specifier: string) => string

	constructor(options: ResolverOptions) {
		this.root = options.root
		this.resolvePathFn = options.resolvePath || ((v: string) => v)
	}

	private normalizeResolved(next: string): string {
		if (path.isAbsolute(next)) {
			next = '/' + path.relative(this.root, next)
		}
		return next.replace(/\\/g, '/')
	}

	resolveImport(specifier: string): string {
		let next = this.resolvePathFn(specifier)
		const looksPath = /^(\.{1,2}\/|\/|@|~)/.test(next)
		if (!looksPath) return specifier

		next = this.normalizeResolved(next)
		return next
	}

	resolveAttrValue(value: string): string {
		let next = this.resolvePathFn(value)
		const looksPath = /^(\.{1,2}\/|\/|@|~)/.test(next)
		if (!looksPath) return value
		next = this.normalizeResolved(next)
		return next
	}
}
