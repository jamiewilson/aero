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

/**
 * Rewrite package.json in targetDir: set name to projectName; if !inMonorepo, replace workspace:* with *.
 * @param {string} targetDir
 * @param {string} projectName
 * @param {boolean} inMonorepo
 */
export function rewritePackageJson(targetDir, projectName, inMonorepo) {
	const pkgPath = join(targetDir, 'package.json')
	if (!existsSync(pkgPath)) return
	const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
	pkg.name = projectName
	if (!inMonorepo) {
		const rewrite = deps => {
			if (!deps) return
			for (const key of Object.keys(deps)) {
				if (deps[key] === 'workspace:*') deps[key] = '*'
			}
		}
		rewrite(pkg.dependencies)
		rewrite(pkg.devDependencies)
	}
	writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
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
	const isKitchenSink = template === 'kitchen-sink'
	const lines = [
		`# ${projectName}`,
		'',
		`Built with [Aero](https://github.com/aerobuilt/aero) — an HTML-first static site generator powered by Vite.`,
		'',
		'## Commands',
		'',
		'| Command | Description |',
		'|---|---|',
		'| `pnpm dev` | Start the dev server |',
		'| `pnpm build` | Build for production |',
		'| `pnpm preview` | Preview the built site |',
	]

	if (isKitchenSink) {
		lines.push('| `pnpm preview:api` | Preview with Nitro API server |')
	}

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
		'```',
	)

	if (isKitchenSink) {
		lines.push(
			'',
			'Additional directories:',
			'',
			'- `server/api/` — Nitro API routes',
			'- `server/routes/` — Nitro server routes',
			'- `aero.config.ts` — Aero configuration',
			'- `content.config.ts` — Content collection schemas',
		)
	}

	lines.push(
		'',
		'## Learn More',
		'',
		'- [Aero on GitHub](https://github.com/aerobuilt/aero)',
		'- [aerobuilt on npm](https://www.npmjs.com/package/aerobuilt)',
		'',
	)

	writeFileSync(join(targetDir, 'README.md'), lines.join('\n'))
}
