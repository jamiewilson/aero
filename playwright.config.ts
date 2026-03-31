import { defineConfig, devices } from '@playwright/test'

const crossBrowser = process.env.AERO_E2E_CROSS_BROWSER === '1'

const projects = crossBrowser
	? [
			{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
			{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
			{ name: 'webkit', use: { ...devices['Desktop Safari'] } },
		]
	: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]

export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.spec.ts',
	timeout: 90_000,
	expect: {
		timeout: 10_000,
	},
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: [['list'], ['html', { open: 'never' }]],
	outputDir: 'test-results/playwright',
	use: {
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},
	projects,
})
