/**
 * `aero doctor` — lightweight environment checklist (no server, no full compile).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Minimum Node major supported for running Aero tooling. */
export const AERO_DOCTOR_MIN_NODE_MAJOR = 18

/**
 * Whether a `process.versions.node`-style value (e.g. `22.1.0`) meets the Aero CLI minimum.
 */
export function nodeMeetsAeroMinimum(nodeVersion: string): boolean {
	const major = parseInt(nodeVersion.split('.')[0]!, 10)
	return Number.isFinite(major) && major >= AERO_DOCTOR_MIN_NODE_MAJOR
}

function readCliVersion(): string | null {
	try {
		const here = path.dirname(fileURLToPath(import.meta.url))
		const pkgPath = path.join(here, '..', 'package.json')
		const raw = fs.readFileSync(pkgPath, 'utf-8')
		const v = JSON.parse(raw) as { version?: string }
		return v.version ?? null
	} catch {
		return null
	}
}

function viteMajorFromRange(spec: string): number | null {
	const cleaned = spec.replace(/^npm:/, '').trim()
	const match = cleaned.match(/(\d+)/)
	return match ? parseInt(match[1]!, 10) : null
}

/**
 * Print environment checklist for an Aero project root.
 *
 * @returns `1` if Node.js is below {@link AERO_DOCTOR_MIN_NODE_MAJOR}; otherwise `0` (warnings still exit 0).
 */
export function runAeroDoctor(root: string): number {
	const lines: string[] = []
	let failed = false

	if (!nodeMeetsAeroMinimum(process.versions.node)) {
		lines.push(
			`[fail] Node.js ${process.version} — Aero expects Node ${AERO_DOCTOR_MIN_NODE_MAJOR}+`
		)
		failed = true
	} else {
		lines.push(`[ok]   Node.js ${process.version}`)
	}

	const pkgPath = path.join(root, 'package.json')
	if (fs.existsSync(pkgPath)) {
		try {
			const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
				dependencies?: Record<string, string>
				devDependencies?: Record<string, string>
			}
			const deps = {
				...pkg.dependencies,
				...pkg.devDependencies,
			}
			const vite = deps['vite']
			if (vite) {
				const vm = viteMajorFromRange(vite)
				if (vm !== null && vm < 8) {
					lines.push(
						`[warn] Vite ${vite} — @aero-js/core expects Vite ^8 (upgrade for best compatibility)`
					)
				} else {
					lines.push(`[ok]   Vite ${vite}`)
				}
			} else {
				lines.push(
					`[warn] No vite dependency in package.json (Aero apps normally depend on Vite ^8)`
				)
			}
			if (deps['@aero-js/core'] || deps['@aero-js/vite']) {
				lines.push(`[ok]   Aero framework dependency present`)
			} else {
				lines.push(
					`[info] No @aero-js/core / @aero-js/vite in package.json (normal in some monorepos)`
				)
			}
		} catch {
			lines.push(`[warn] Could not parse package.json`)
		}
	} else {
		lines.push(`[warn] No package.json at project root`)
	}

	const cliVer = readCliVersion()
	if (cliVer) {
		lines.push(`[ok]   @aero-js/cli ${cliVer}`)
	} else {
		lines.push(`[info] Could not read @aero-js/cli version`)
	}

	lines.push(
		`[info] Install the “Aero” VS Code extension for template diagnostics and aero check from the palette`
	)

	process.stdout.write(lines.join('\n') + '\n')
	return failed ? 1 : 0
}
