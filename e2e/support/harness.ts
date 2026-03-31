import { spawn } from 'node:child_process'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

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

export const startStaticPreview = async (
	cwd: string,
	port: number,
	buildEnv?: Record<string, string | undefined>
) => {
	await runCommand('build', 'pnpm', ['build'], {
		cwd,
		env: buildEnv,
		timeoutMs: 180_000,
	})

	return startServer(
		'Vite preview server',
		'pnpm',
		['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', `${port}`, '--strictPort'],
		{ cwd, port }
	)
}

export const startNitroPreview = async (cwd: string, port: number) => {
	await runCommand('build', 'pnpm', ['build'], {
		cwd,
		timeoutMs: 180_000,
	})

	return startServer('Nitro preview server', 'node', ['.output/server/index.mjs'], {
		cwd,
		port,
		env: { PORT: `${port}` },
	})
}

export const scaffoldCreateApp = async (name: string) => {
	const createRoot = repoPath('packages', 'create')
	const appRoot = path.join(createRoot, 'dist', name)

	await rm(appRoot, { recursive: true, force: true })
	await runCommand(
		'scaffold create app',
		'node',
		['index.js', name, '--template', 'minimal', '--strict'],
		{
			cwd: createRoot,
			timeoutMs: 240_000,
		}
	)

	return appRoot
}

export const removePath = async (target: string) => {
	await rm(target, { recursive: true, force: true })
}
