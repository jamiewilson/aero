import { expect, test } from '@playwright/test'
import {
	chromiumOnly,
	repoPath,
	startStaticPreview,
	type ServerHandle,
} from './support/harness'

const starterRoot = repoPath('packages', 'starters', 'minimal')

test.describe('starter minimal preview', () => {
	test.describe.configure({ mode: 'serial' })

	let server: ServerHandle

	test.beforeAll(async () => {
		server = await startStaticPreview(starterRoot, 4305)
	})

	test.afterAll(async () => {
		if (server) await server.stop()
	})

	test('renders the starter home and about pages', async ({ page, browserName }) => {
		test.skip(chromiumOnly(browserName), 'Starter smoke runs in Chromium only')

		await page.goto(server.url)
		await expect(page.getByRole('heading', { name: 'Welcome to Aero' })).toBeVisible()

		await page.goto(`${server.url}/about/`)
		await expect(page).toHaveTitle('Meta Title')
		await expect(page.getByRole('heading', { name: 'About' })).toBeVisible()
	})
})
