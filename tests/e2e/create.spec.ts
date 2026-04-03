import { expect, test } from '@playwright/test'
import path from 'node:path'
import {
	chromiumOnly,
	removePath,
	scaffoldCreateApp,
	startStaticPreview,
	startViteDev,
	type ServerHandle,
} from './support/harness'

test.describe('create generated app', () => {
	test.describe.configure({ mode: 'serial' })
	test.setTimeout(300_000)

	let appRoot = ''

	test.beforeAll(async () => {
		appRoot = await scaffoldCreateApp(`e2e-create-${Date.now()}`)
	})

	test.afterAll(async () => {
		if (appRoot) await removePath(appRoot)
	})

	test('boots the generated app in dev', async ({ page, browserName }) => {
		test.skip(chromiumOnly(browserName), 'Create smoke runs in Chromium only')

		let server: ServerHandle | undefined
		try {
			server = await startViteDev(appRoot, 4306)
			await page.goto(server.url)
			await expect(page.getByRole('heading', { name: 'Welcome to Aero' })).toBeVisible()
			await expect(page.locator('footer')).toContainText('Home')
		} finally {
			if (server) await server.stop()
		}
	})

	test('builds and previews the generated app', async ({ page, browserName }) => {
		test.skip(chromiumOnly(browserName), 'Create smoke runs in Chromium only')
		expect(path.basename(appRoot)).toContain('e2e-create-')

		let server: ServerHandle | undefined
		try {
			server = await startStaticPreview(appRoot, 4307)
			await page.goto(`${server.url}/about/`)
			await expect(page).toHaveTitle('Meta Title')
			await expect(page.getByRole('heading', { name: 'About' })).toBeVisible()
		} finally {
			if (server) await server.stop()
		}
	})
})
