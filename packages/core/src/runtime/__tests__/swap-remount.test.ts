/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { shouldRemountCompiledSwap } from '../swap-remount'

describe('shouldRemountCompiledSwap', () => {
	it('returns false when the route has no state bindings', () => {
		const root = document.createElement('main')
		root.id = 'app'
		const target = document.createElement('section')
		root.append(target)
		expect(
			shouldRemountCompiledSwap(
				root,
				{ target, targetSelector: '#section' },
				false
			)
		).toBe(false)
	})

	it('remounts when swapping the compiled root', () => {
		const root = document.createElement('main')
		root.id = 'app'
		expect(
			shouldRemountCompiledSwap(root, { target: root, targetSelector: '#app' }, true)
		).toBe(true)
	})

	it('remounts when the target subtree has compiled bind markers', () => {
		const root = document.createElement('main')
		root.innerHTML = '<section id="panel"><span data-aero-text="0">x</span></section>'
		const panel = root.querySelector('#panel') as HTMLElement
		expect(
			shouldRemountCompiledSwap(
				root,
				{ target: panel, targetSelector: '#panel' },
				true
			)
		).toBe(true)
	})

	it('keeps runtime fragments on the process path', () => {
		const root = document.createElement('main')
		root.innerHTML =
			'<section id="runtime-host">old</section><section id="compiled"><span data-aero-text="0">x</span></section>'
		const runtimeHost = root.querySelector('#runtime-host') as HTMLElement
		expect(
			shouldRemountCompiledSwap(
				root,
				{ target: runtimeHost, targetSelector: '#runtime-host' },
				true
			)
		).toBe(false)
	})
})
