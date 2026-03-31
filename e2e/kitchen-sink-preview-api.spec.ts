import { expect, test } from '@playwright/test'
import { repoPath, startNitroPreview, type ServerHandle } from './support/harness'

const kitchenSinkRoot = repoPath('examples', 'kitchen-sink')

test.describe('kitchen-sink preview:api', () => {
	test.describe.configure({ mode: 'serial' })

	let server: ServerHandle

	test.beforeAll(async () => {
		server = await startNitroPreview(kitchenSinkRoot, 4301)
	})

	test.afterAll(async () => {
		await server.stop()
	})

	test('submits the HTMX form and renders the toast fragment', async ({ page }) => {
		await page.goto(server.url)

		const input = page.getByTestId('home-message-input')
		const button = page.getByRole('button', { name: 'Send POST Request' })

		await expect(button).toBeDisabled()
		await input.fill('hello from playwright')
		await expect(button).toBeEnabled()

		await Promise.all([
			page.waitForResponse(
				response =>
					response.url().endsWith('/api/submit') &&
					response.request().method() === 'POST' &&
					response.status() === 200
			),
			button.click(),
		])

		await expect(page.getByTestId('home-toast')).toContainText('Server received POST:')
		await expect(page.getByTestId('home-toast')).toContainText('hello from playwright')
		await expect(input).toHaveValue('')
	})

	test('keeps redirects and missing API routes separate', async ({ page, request }) => {
		const apiResponse = await request.get(`${server.url}/api/missing`)
		expect(apiResponse.status()).toBe(404)
		expect(await apiResponse.text()).toContain('API route not found')

		await page.goto(`${server.url}/home`)
		await expect(page).toHaveURL(`${server.url}/`)

		await page.goto(`${server.url}/docs`)
		await expect(page).toHaveURL(`${server.url}/docs/`)
		await expect(page.getByRole('heading', { name: 'Docs' })).toBeVisible()
	})
})
