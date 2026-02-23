/**
 * Resolves import specifiers and attribute values using project path aliases.
 *
 * @remarks
 * Wraps a `resolvePath` function (e.g. from tsconfig aliases). Paths that look like file/URL paths
 * (starting with `./`, `../`, `/`, `@`, `~`) are resolved and normalized; others are returned unchanged.
 * Paths under the project root are returned as root-relative with forward slashes.
 */

import type { ResolverOptions } from '../types'
import path from 'path'

export class Resolver {
	private root: string
	private rootAbs: string
	private resolvePathFn: (specifier: string) => string

	constructor(options: ResolverOptions) {
		this.root = options.root
		this.rootAbs = path.resolve(this.root)
		this.resolvePathFn = options.resolvePath || ((v: string) => v)
	}

	/** Normalize resolved path: root-relative with `/` if under root, else posix-normalized; always forward slashes. */
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

	/**
	 * Resolve an import specifier (e.g. `@components/header`) to a path.
	 * Returns the original specifier if the resolved value does not look like a path.
	 *
	 * @param specifier - Import specifier from the source file.
	 * @returns Resolved path or unchanged specifier.
	 */
	resolveImport(specifier: string): string {
		let next = this.resolvePathFn(specifier)
		const looksPath = /^(\.{1,2}\/|\/|@|~)/.test(next)
		if (!looksPath) return specifier

		next = this.normalizeResolved(next)
		return next
	}

	/**
	 * Resolve an attribute value that may be a path (e.g. `src` on script).
	 * Same rules as `resolveImport`; returns unchanged value if not path-like.
	 *
	 * @param value - Raw attribute value.
	 * @returns Resolved path or unchanged value.
	 */
	resolveAttrValue(value: string): string {
		let next = this.resolvePathFn(value)
		const looksPath = /^(\.{1,2}\/|\/|@|~)/.test(next)
		if (!looksPath) return value
		next = this.normalizeResolved(next)
		return next
	}
}
