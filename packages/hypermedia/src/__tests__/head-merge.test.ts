import { describe, expect, it, beforeEach } from 'vitest'
import { isFullPageRegionTarget, mergeHeadFromHtml } from '../head-merge'

describe('isFullPageRegionTarget', () => {
	it('matches body, html, and #app selectors', () => {
		expect(isFullPageRegionTarget('body')).toBe(true)
		expect(isFullPageRegionTarget('html')).toBe(true)
		expect(isFullPageRegionTarget('#app')).toBe(true)
	})

	it('rejects fragment targets', () => {
		expect(isFullPageRegionTarget('#panel')).toBe(false)
		expect(isFullPageRegionTarget('.content')).toBe(false)
	})
})

describe('mergeHeadFromHtml', () => {
	beforeEach(() => {
		document.head.innerHTML = '<title>Old</title><meta name="description" content="old">'
	})

	it('updates title and merges meta by name', () => {
		mergeHeadFromHtml(`<!DOCTYPE html><html><head>
			<title>New title</title>
			<meta name="description" content="new">
			<meta name="theme-color" content="#111">
		</head><body></body></html>`)

		expect(document.title).toBe('New title')
		expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('new')
		expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#111')
	})

	it('merges meta by property attribute', () => {
		document.head.innerHTML = '<meta property="og:title" content="old">'
		mergeHeadFromHtml(`<head><meta property="og:title" content="fresh"></head>`)
		expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('fresh')
	})
})
