import { describe, expect, it } from 'vitest'
import { syncMethodOverride } from '../method-override'

describe('syncMethodOverride', () => {
	it('injects _method hidden input for PUT/PATCH/DELETE forms', () => {
		document.body.innerHTML = '<form id="f"><input name="x" value="1"></form>'
		const form = document.querySelector('#f') as HTMLFormElement

		syncMethodOverride(form, 'PUT')
		const input = form.querySelector<HTMLInputElement>('input[name="_method"]')
		expect(input?.value).toBe('PUT')
		expect(form.method.toLowerCase()).toBe('post')
	})

	it('updates existing _method input when method changes', () => {
		document.body.innerHTML =
			'<form id="f" method="post"><input type="hidden" name="_method" value="PUT"></form>'
		const form = document.querySelector('#f') as HTMLFormElement

		syncMethodOverride(form, 'DELETE')
		expect(form.querySelector<HTMLInputElement>('input[name="_method"]')?.value).toBe('DELETE')
	})

	it('removes _method input for GET and POST', () => {
		document.body.innerHTML =
			'<form id="f"><input type="hidden" name="_method" value="DELETE"></form>'
		const form = document.querySelector('#f') as HTMLFormElement

		syncMethodOverride(form, 'POST')
		expect(form.querySelector('input[name="_method"]')).toBeNull()
	})
})
