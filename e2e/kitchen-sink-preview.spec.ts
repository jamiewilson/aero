import { expect, test } from '@playwright/test'
import { repoPath, startStaticPreview, type ServerHandle } from './support/harness'

const kitchenSinkRoot = repoPath('examples', 'kitchen-sink')

test.describe('kitchen-sink preview', () => {
	test.describe.configure({ mode: 'serial' })

	let server: ServerHandle

	test.beforeAll(async () => {
		server = await startStaticPreview(kitchenSinkRoot, 4302, { AERO_SERVER: 'false' })
	})

	test.afterAll(async () => {
		await server.stop()
	})

	test('renders the built home page', async ({ page }) => {
		await page.goto(server.url)
		await expect(page.getByText('mostly-vanilla HTML projects.')).toBeVisible()
		await expect(page.getByTestId('theme-toggle')).toBeVisible()
	})

	test('excludes draft docs from the built docs index and preserves deep-link assets', async ({
		page,
	}) => {
		await page.goto(`${server.url}/docs/`)
		await expect(page.getByTestId('docs-list')).not.toContainText('Draft Doc')

		await page.goto(`${server.url}/docs/props/`)
		await expect(page.getByRole('heading', { name: 'Props', exact: true })).toBeVisible()

		const stylesheetHref = await page.locator('link[rel="stylesheet"]').first().getAttribute('href')
		expect(stylesheetHref?.startsWith('../../assets/')).toBe(true)
	})

	test('serves the custom 404 page from the static build', async ({ page }) => {
		const response = await page.goto(`${server.url}/404.html`)
		expect(response?.ok()).toBe(true)
		await expect(page.getByTestId('not-found-page')).toBeVisible()
	})
})
