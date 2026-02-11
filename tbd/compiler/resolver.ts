import path from 'path'
import type { ResolverOptions } from '@tbd/types'

export class Resolver {
	private root: string
	private rootAbs: string
	private resolvePathFn: (specifier: string) => string

	constructor(options: ResolverOptions) {
		this.root = options.root
		this.rootAbs = path.resolve(this.root)
		this.resolvePathFn = options.resolvePath || ((v: string) => v)
	}

	private normalizeResolved(next: string): string {
		if (path.isAbsolute(next)) {
			const absolute = path.resolve(next)
			const isWithinRoot =
				absolute === this.rootAbs || absolute.startsWith(this.rootAbs + path.sep)

			if (isWithinRoot) {
				next = '/' + path.relative(this.rootAbs, absolute)
			} else {
				// Preserve URL-like absolute paths (e.g. "/api/submit"), but canonicalize segments
				next = path.posix.normalize(next.replace(/\\/g, '/'))
			}
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
