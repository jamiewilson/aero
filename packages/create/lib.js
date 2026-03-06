import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

const DEFAULT_TEMPLATE = 'minimal'

/**
 * Parse CLI argv into { target, template }.
 * @param {string[]} argv - process.argv
 * @returns {{ target: string | null, template: string }}
 */
export function parseArgs(argv) {
	const args = argv.slice(2)
	let target = null
	let template = DEFAULT_TEMPLATE
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--template' && args[i + 1]) {
			template = args[++i]
			continue
		}
		if (!args[i].startsWith('-') && !target) {
			target = args[i]
		}
	}
	return { target, template }
}

const PACKAGE_TEMPLATE = 'package-template.json'

/**
 * Write package.json in targetDir from the template's package-template.json, with name and @aero-js/core version filled in.
 * @param {string} templatePath - Path to the template directory (e.g. packages/templates/minimal)
 * @param {string} targetDir - Path to the scaffolded project directory
 * @param {string} projectName - Project name for package.json "name"
 * @param {boolean} inMonorepo - If true, use workspace:* for @aero-js/core; otherwise use coreVersion
 * @param {string} [coreVersion] - When !inMonorepo, version range for @aero-js/core (e.g. ^0.2.9). Omit to use '*'.
 */
export function rewritePackageJson(
	templatePath,
	targetDir,
	projectName,
	inMonorepo,
	coreVersion
) {
	const templatePkgPath = join(templatePath, PACKAGE_TEMPLATE)
	if (!existsSync(templatePkgPath)) {
		console.error(
			`create-aero-js: template is missing ${PACKAGE_TEMPLATE}. Each template must provide this file.`
		)
		process.exit(1)
	}
	const pkg = JSON.parse(readFileSync(templatePkgPath, 'utf8'))
	pkg.name = projectName
	const depVersion = inMonorepo
		? 'workspace:*'
		: coreVersion
			? `^${coreVersion}`
			: '*'
	if (pkg.dependencies) {
		if (pkg.dependencies['@aero-js/core'] !== undefined) {
			pkg.dependencies['@aero-js/core'] = depVersion
		}
		if (pkg.dependencies['@aero-js/vite'] !== undefined) {
			pkg.dependencies['@aero-js/vite'] = depVersion
		}
	}
	writeFileSync(
		join(targetDir, 'package.json'),
		JSON.stringify(pkg, null, 2) + '\n'
	)
}

/**
 * Walk up from fromDir to find directory containing pnpm-workspace.yaml.
 * @param {string} fromDir
 * @returns {string | null}
 */
export function findWorkspaceRoot(fromDir) {
	let dir = fromDir
	for (;;) {
		if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
		const parent = dirname(dir)
		if (parent === dir) return null
		dir = parent
	}
}

/**
 * Write a project-appropriate README.md into targetDir.
 * @param {string} targetDir
 * @param {string} projectName
 * @param {string} template
 */
export function writeReadme(targetDir, projectName, template) {
	const lines = [
		`# ${projectName}`,
		'',
		`Built with [Aero](https://github.com/jamiewilson/aero) — an HTML-first static site generator powered by Vite.`,
		'',
		'## Commands',
		'',
		'| Command | Description |',
		'|---|---|',
		'| `pnpm dev` | Start the dev server |',
		'| `pnpm build` | Build for production |',
		'| `pnpm preview` | Preview the built site |',
	]

	lines.push(
		'',
		'## Project Structure',
		'',
		'```',
		`${projectName}/`,
		'├── client/',
		'│   ├── assets/         # Styles, scripts, images',
		'│   ├── components/     # Reusable .html components',
		'│   ├── layouts/        # Layout wrappers with <slot>',
		'│   └── pages/          # File-based routing',
		'├── content/',
		'│   └── site.ts         # Global site data',
		'├── public/             # Static assets (copied as-is)',
		'├── vite.config.ts      # Aero Vite plugin',
		'└── tsconfig.json       # Path aliases',
		'```'
	)

	lines.push(
		'',
		'## Learn More',
		'',
		'- [Aero on GitHub](https://github.com/jamiewilson/aero)',
		'- [@aero-js/core on npm](https://www.npmjs.com/package/@aero-js/core)',
		''
	)

	writeFileSync(join(targetDir, 'README.md'), lines.join('\n'))
}
