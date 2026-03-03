#!/usr/bin/env node
/**
 * Bump version in all published packages (lockstep).
 * Usage: node scripts/bump-versions.js <newVersion>
 * Example: node scripts/bump-versions.js 0.2.2
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const newVersion = process.argv[2]

if (!newVersion || !/^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/i.test(newVersion)) {
	console.log('Usage: node scripts/bump-versions.js <newVersion>')
	console.log('Example: node scripts/bump-versions.js 0.2.2')
	console.log('Version must be semver (e.g. 0.2.9 or 1.0.0-beta.1).')
	process.exit(1)
}

const packagePaths = [
	'packages/core/package.json',
	'packages/interpolation/package.json',
	'packages/config/package.json',
	'packages/content/package.json',
	'packages/highlight/package.json',
	'packages/aerobuilt/package.json',
	'packages/create-aerobuilt/package.json',
	'packages/templates/minimal/package.json',
	'packages/aero-vscode/package.json',
]

/** @type {Map<string, string>} */
const currentVersions = new Map()

for (const rel of packagePaths) {
	const path = join(root, rel)
	let content
	try {
		content = readFileSync(path, 'utf8')
	} catch (err) {
		console.error(`🔺 Could not read ${rel}:`, err.message)
		process.exit(1)
	}
	const match = content.match(/^\s*"version":\s*"([^"]*)"/m)
	if (!match) {
		console.error(`🔺 ${rel}: no "version" field found`)
		process.exit(1)
	}
	currentVersions.set(rel, match[1])
}

const distinct = [...new Set(currentVersions.values())]

if (distinct.length === 1 && distinct[0] === newVersion) {
	console.error(`✅ All packages are already at ${newVersion}`)
	process.exit(0)
}

if (distinct.length > 1) {
	console.error('Package versions are out of sync:')
	for (const [rel, v] of currentVersions) {
		console.error(` ${rel}: ${v}`)
	}
	console.error(`\nSyncing all to ${newVersion}...\n`)
}

for (const rel of packagePaths) {
	const path = join(root, rel)
	const content = readFileSync(path, 'utf8')
	const updated = content.replace(/^(\s*"version":\s*)"[^"]*"/m, `$1"${newVersion}"`)
	if (updated === content) {
		console.log(`✔︎ ${rel}: already ${newVersion}`)
		continue
	}
	writeFileSync(path, updated)
	console.log(`✔︎ Updated ${rel} -> ${newVersion}`)
}

console.log(`\n✅ Bumped ${packagePaths.length} packages to ${newVersion}`)
