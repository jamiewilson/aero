import type { HttpMethod } from './types'

const METHOD_OVERRIDE_INPUT_NAME = '_method'

export function syncMethodOverride(trigger: Element | undefined, method: HttpMethod): void {
	if (!(trigger instanceof HTMLFormElement)) return

	const existing = trigger.querySelector<HTMLInputElement>(`input[name="${METHOD_OVERRIDE_INPUT_NAME}"]`)

	if (method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
		const input = existing ?? document.createElement('input')
		if (!existing) {
			input.type = 'hidden'
			input.name = METHOD_OVERRIDE_INPUT_NAME
			trigger.prepend(input)
		}
		input.value = method
		if (trigger.method.toLowerCase() !== 'post') {
			trigger.method = 'post'
		}
		return
	}

	existing?.remove()
}
