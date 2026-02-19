import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('vscode', () => {
	return {
		workspace: {
			getWorkspaceFolder: vi.fn((uri: any) => {
				if (uri?.fsPath?.startsWith('/workspace')) {
					return { uri: { fsPath: '/workspace' } }
				}
				return undefined
			}),
			getConfiguration: vi.fn(() => ({ get: vi.fn(() => 'auto') })),
		},
		Uri: {
			file: (s: string) => ({ fsPath: s, scheme: 'file' }),
		},
	}
})

vi.mock('node:fs', () => ({
	existsSync: vi.fn((path: string) => {
		if (path.includes('vite.config.ts') || path.includes('package.json') || path.includes('tsconfig.json')) {
			if (path.includes('aero') || path.includes('workspace')) {
				return true
			}
		}
		return false
	}),
	readFileSync: vi.fn((path: string) => {
		if (path.includes('vite.config.ts')) {
			return "import { aero } from '@aero-ssg/core'"
		}
		if (path.includes('package.json')) {
			return '{ "name": "test-project" }'
		}
		return '{}'
	}),
}))

describe('scope', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('isAeroDocument', () => {
		it('should return false for non-HTML documents', async () => {
			const { isAeroDocument } = await import('../scope')
			
			const doc = {
				languageId: 'javascript',
				uri: { scheme: 'file', fsPath: '/test.js' },
			} as any

			expect(isAeroDocument(doc)).toBe(false)
		})

		it('should return false for non-file URIs', async () => {
			const { isAeroDocument } = await import('../scope')
			
			const doc = {
				languageId: 'html',
				uri: { scheme: 'untitled', fsPath: '/test.html' },
			} as any

			expect(isAeroDocument(doc)).toBe(false)
		})
	})

	describe('getScopeMode', () => {
		it('should return default mode as auto', async () => {
			const { getScopeMode } = await import('../scope')
			
			expect(getScopeMode()).toBe('auto')
		})
	})
})

describe('pathResolver', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('getResolver', () => {
		it('should return a resolver object with root and resolve method', async () => {
			const { getResolver, clearResolverCache } = await import('../pathResolver')
			clearResolverCache()
			
			const doc = {
				uri: { fsPath: '/workspace/test.html' },
			} as any

			const resolver = getResolver(doc)
			
			expect(resolver).toBeDefined()
			expect(resolver.root).toBe('/workspace')
			expect(typeof resolver.resolve).toBe('function')
		})
	})

	describe('clearResolverCache', () => {
		it('should be exported function', async () => {
			const { clearResolverCache } = await import('../pathResolver')
			
			expect(typeof clearResolverCache).toBe('function')
		})
	})
})
