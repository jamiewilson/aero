import { expect, test } from '@playwright/test'
import { repoPath, startViteDev, type ServerHandle } from './support/harness'

const kitchenSinkRoot = repoPath('examples', 'kitchen-sink')

test.describe('kitchen-sink dev', () => {
	test.describe.configure({ mode: 'serial' })

	let server: ServerHandle

	test.beforeAll(async () => {
		server = await startViteDev(kitchenSinkRoot, 4303)
	})

	test.afterAll(async () => {
		await server.stop()
	})

	test('redirects /home and persists theme selection', async ({ page }) => {
		await page.goto(`${server.url}/home`)
		await expect(page).toHaveURL(`${server.url}/`)

		const html = page.locator('html')
		await expect(html).toHaveAttribute('data-theme', 'system')

		await page.getByTestId('theme-toggle').click()
		await expect(html).toHaveAttribute('data-theme', 'light')

		await page.reload()
		await expect(html).toHaveAttribute('data-theme', 'light')
	})

	test('shows draft docs in dev and resolves dynamic docs routes', async ({ page }) => {
		await page.goto(`${server.url}/docs/`)
		await expect(page.getByTestId('docs-list')).toContainText('Draft Doc')

		await page.goto(`${server.url}/docs/draft`)
		await expect(page.getByRole('heading', { name: 'Draft Doc' })).toBeVisible()
	})

	test('renders the custom 404 page in dev', async ({ page }) => {
		await page.goto(`${server.url}/missing`)
		await expect(page.getByTestId('not-found-page')).toBeVisible()
	})
})
