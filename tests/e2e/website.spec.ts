import { expect, test } from '@playwright/test'
import { repoPath, startStaticPreview, type ServerHandle } from './support/harness'

const websiteRoot = repoPath('website')

test.describe('website preview', () => {
	test.describe.configure({ mode: 'serial' })

	let server: ServerHandle

	test.beforeAll(async () => {
		server = await startStaticPreview(websiteRoot, 4304)
	})

	test.afterAll(async () => {
		await server.stop()
	})

	test('renders built content and initializes theme from localStorage', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('theme', JSON.stringify('dark'))
		})

		await page.goto(server.url)
		await expect(page.getByRole('heading', { name: 'Aero' })).toBeVisible()
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
	})

	test('updates the table of contents state on hash navigation', async ({ page }) => {
		await page.goto(server.url)

		const toc = page.getByTestId('toc')
		const commandsLink = toc.getByRole('link', { name: 'Commands' })

		await commandsLink.click()
		await expect(page).toHaveURL(/#commands$/)
		await page.evaluate(() => {
			const heading = document.getElementById('commands')
			if (!heading) return
			const top = heading.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.45
			window.scrollTo({ top })
		})
		await expect
			.poll(async () =>
				page.evaluate(
					() => document.querySelector('[data-toc-link].current')?.getAttribute('href') ?? ''
				)
			)
			.toBe('#commands')
	})
})
