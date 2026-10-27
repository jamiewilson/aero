import { spawn } from 'node:child_process'
import { cpSync, readFileSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type CommandOptions = {
	cwd: string
	env?: Record<string, string | undefined>
	timeoutMs?: number
}

type StartServerOptions = CommandOptions & {
	port: number
}

export type ServerHandle = {
	url: string
	stop: () => Promise<void>
}

const resolveBinary = (binary: string) => {
	if (process.platform === 'win32' && (binary === 'pnpm' || binary === 'node')) {
		return `${binary}.cmd`
	}
	return binary
}

const collectOutput = (child: ReturnType<typeof spawn>) => {
	let output = ''
	child.stdout?.on('data', chunk => {
		output += chunk.toString()
	})
	child.stderr?.on('data', chunk => {
		output += chunk.toString()
	})
	return () => output
}

const waitForHttp = async (url: string, timeoutMs: number) => {
	const deadline = Date.now() + timeoutMs
	let lastError: unknown

	while (Date.now() < deadline) {
		try {
			const response = await fetch(url, { redirect: 'manual' })
			if (response.status < 500) return
			lastError = new Error(`Received ${response.status} from ${url}`)
		} catch (error) {
			lastError = error
		}
		await sleep(250)
	}

	throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`)
}

const waitForExit = async (child: ReturnType<typeof spawn>) =>
	new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
		child.once('error', reject)
		child.once('exit', (code, signal) => resolve({ code, signal }))
	})

const sendSignal = (child: ReturnType<typeof spawn>, signal: NodeJS.Signals) => {
	try {
		if (process.platform === 'win32') {
			child.kill(signal)
		} else if (child.pid) {
			process.kill(-child.pid, signal)
		}
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code
		if (code !== 'ESRCH' && code !== 'EPERM') throw error
	}
}

const stopChild = async (child: ReturnType<typeof spawn>) => {
	if (child.exitCode !== null) return

	sendSignal(child, 'SIGTERM')
	await Promise.race([waitForExit(child), sleep(2_000)])

	if (child.exitCode === null) {
		sendSignal(child, 'SIGKILL')
		await Promise.race([waitForExit(child), sleep(2_000)])
	}
}

export const repoPath = (...segments: string[]) => path.join(repoRoot, ...segments)

export const chromiumOnly = (browserName: string) => browserName !== 'chromium'

export const runCommand = async (
	name: string,
	command: string,
	args: string[],
	{ cwd, env, timeoutMs = 120_000 }: CommandOptions
) => {
	const child = spawn(resolveBinary(command), args, {
		cwd,
		detached: process.platform !== 'win32',
		env: { ...process.env, ...env },
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	const readOutput = collectOutput(child)

	const timeout = setTimeout(() => {
		child.kill('SIGTERM')
	}, timeoutMs)

	try {
		const { code, signal } = await waitForExit(child)
		if (code !== 0) {
			throw new Error(
				`${name} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}\n${readOutput()}`
			)
		}
		return readOutput()
	} finally {
		clearTimeout(timeout)
	}
}

const startServer = async (
	name: string,
	command: string,
	args: string[],
	{ cwd, env, port, timeoutMs = 120_000 }: StartServerOptions
): Promise<ServerHandle> => {
	const child = spawn(resolveBinary(command), args, {
		cwd,
		detached: process.platform !== 'win32',
		env: { ...process.env, ...env },
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	const readOutput = collectOutput(child)
	const url = `http://127.0.0.1:${port}`

	try {
		await waitForHttp(url, timeoutMs)
	} catch (error) {
		await stopChild(child)
		throw new Error(`${name} did not become ready\n${readOutput()}\n${String(error)}`)
	}

	return {
		url,
		stop: async () => {
			await stopChild(child)
		},
	}
}

export const startViteDev = async (cwd: string, port: number) =>
	startServer(
		'Vite dev server',
		'pnpm',
		['exec', 'vite', 'dev', '--host', '127.0.0.1', '--port', `${port}`, '--strictPort'],
		{ cwd, port }
	)

const buildApp = async (
	cwd: string,
	buildEnv?: Record<string, string | undefined>,
	buildArgs: string[] = []
) => {
	await runCommand('build', 'pnpm', ['exec', 'vp', 'build', ...buildArgs], {
		cwd,
		env: buildEnv,
		timeoutMs: 180_000,
	})
}

export const startStaticPreview = async (
	cwd: string,
	port: number,
	buildEnv?: Record<string, string | undefined>,
	buildArgs?: string[]
) => {
	await buildApp(cwd, buildEnv, buildArgs)

	return startServer(
		'Vite preview server',
		'pnpm',
		['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', `${port}`, '--strictPort'],
		{ cwd, port }
	)
}

export const startNitroPreview = async (cwd: string, port: number) => {
	await buildApp(cwd)

	return startServer('Nitro preview server', 'node', ['.output/server/index.mjs'], {
		cwd,
		port,
		env: { PORT: `${port}` },
	})
}

const TEMPLATE_SKIP_DIR = new Set(['node_modules', 'dist', '.output', '.vite', '.aero', '.nitro'])

const copyCreateTemplate = (template: 'minimal' | 'fullstack', dest: string) => {
	const src = repoPath('packages', 'create', 'templates', template)
	cpSync(src, dest, {
		recursive: true,
		filter: (_src, target) => {
			const base = path.basename(target)
			return !TEMPLATE_SKIP_DIR.has(base)
		},
	})
}

const linkScaffoldToWorkspace = (packageJsonPath: string) => {
	const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
		dependencies?: Record<string, string>
		devDependencies?: Record<string, string>
	}
	if (pkg.dependencies?.['@aero-js/core']) {
		pkg.dependencies['@aero-js/core'] = 'workspace:*'
	}
	delete pkg.devDependencies?.['@aero-js/prettier-plugin-aero']
	writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, '\t')}\n`)
}

export const scaffoldCreateApp = async (name: string) => {
	const appRoot = repoPath('examples', name)

	await rm(appRoot, { recursive: true, force: true })
	copyCreateTemplate('minimal', appRoot)
	linkScaffoldToWorkspace(path.join(appRoot, 'package.json'))

	await runCommand('pnpm install', 'pnpm', ['install'], {
		cwd: repoRoot,
		timeoutMs: 240_000,
	})

	return appRoot
}

export const removePath = async (target: string) => {
	await rm(target, { recursive: true, force: true })
}
