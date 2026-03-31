import { expect, test } from '@playwright/test'
import {
	chromiumOnly,
	repoPath,
	startStaticPreview,
	type ServerHandle,
} from './support/harness'

const examples = [
	'cdn-externals',
	'cdn-globals',
	'dynamic-import',
	'esm-import-map',
	'single-bundle',
] as const

test.describe('import bundling examples', () => {
	for (const [index, example] of examples.entries()) {
		test(`counter works in ${example}`, async ({ page, browserName }) => {
			test.skip(chromiumOnly(browserName), 'Import-bundling smoke runs in Chromium only')
			test.slow()

			const exampleRoot = repoPath('examples', 'import-bundling', example)
			let server: ServerHandle | undefined

			try {
				server = await startStaticPreview(exampleRoot, 4310 + index)
				await page.goto(server.url)
				await expect(page.getByRole('heading')).toBeVisible()

				const counter = page.locator('.demo span')
				await expect(counter).toHaveText('0')
				await page.getByRole('button', { name: 'Increment' }).click()
				await expect(counter).toHaveText('1')
			} finally {
				if (server) await server.stop()
			}
		})
	}
})
