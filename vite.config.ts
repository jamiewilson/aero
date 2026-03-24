import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite-plus'

const workspaceRoot = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: workspaceRoot,
  test: {
    include: [
      'packages/config/**/*.test.ts',
      'packages/cli/**/*.test.ts',
      'packages/core/**/*.test.ts',
      'packages/diagnostics/**/*.test.ts',
      'packages/content/**/*.test.ts',
      'packages/highlight/**/*.test.ts',
      'packages/interpolation/**/*.test.ts',
      'packages/vscode/**/*.test.ts',
      'packages/language-server/**/*.test.ts',
      'packages/create/**/*.test.js',
    ],
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    teardownTimeout: 2000,
  },

  lint: {
    ignorePatterns: [
      '**/dist/**',
      '**/.output/**',
      '**/build/**',
      'packages/create/dist/**',
      '**/node_modules/**',
    ],
  },

  run: {
    tasks: {
      'build:packages': {
        command: 'pnpm -r --filter @aero-js/interpolation --filter @aero-js/highlight --filter @aero-js/diagnostics --filter @aero-js/core --filter @aero-js/vite --filter @aero-js/content --filter @aero-js/config --filter @aero-js/cli --filter @aero-js/create run build',
      },
    },
  },
})
