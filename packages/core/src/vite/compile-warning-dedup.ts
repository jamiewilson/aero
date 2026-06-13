/**
 * Suppress repeated compile warnings when Vite recompiles unchanged template source
 * (e.g. runtime-instance HMR re-importing page modules after an edit).
 */

import { createHash } from 'node:crypto'

export interface CompileWarningPayload {
	line?: number
	column?: number
	file?: string
	code: string
	message: string
}

export class CompileWarningDeduper {
	private lastLoggedHashByFile = new Map<string, string>()

	/**
	 * Emit warnings only when `source` changed since the last flush for `filePath`.
	 */
	flushWarnings(
		filePath: string,
		source: string,
		warnings: readonly CompileWarningPayload[],
		log: (warning: CompileWarningPayload) => void
	): void {
		if (warnings.length === 0) return
		const hash = createHash('sha256').update(source).digest('hex').slice(0, 16)
		if (this.lastLoggedHashByFile.get(filePath) === hash) return
		this.lastLoggedHashByFile.set(filePath, hash)
		for (const warning of warnings) {
			log(warning)
		}
	}
}
