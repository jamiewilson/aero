import { Effect } from '../effect'
import type { Cleanup } from '../mount'

export type FormModelKind = 'value' | 'checked'

export interface FormModelBindingOptions {
	readonly target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
	readonly kind: FormModelKind
	readonly read: () => unknown
	readonly write: (value: unknown) => void
	readonly readonly?: boolean
}

function isReadonlyControl(target: HTMLElement): boolean {
	if (target.hasAttribute('disabled')) return true
	if (target.hasAttribute('readonly')) return true
	return false
}

function isRadioInput(
	target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
): target is HTMLInputElement {
	return target instanceof HTMLInputElement && target.type.toLowerCase() === 'radio'
}

function readControlValue(
	target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
	kind: FormModelKind
): unknown {
	if (kind === 'checked' && target instanceof HTMLInputElement) return target.checked
	return target.value
}

function writeControlValue(
	target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
	kind: FormModelKind,
	value: unknown
): void {
	if (kind === 'checked' && target instanceof HTMLInputElement) {
		const next = Boolean(value)
		if (target.checked === next) return
		target.checked = next
		return
	}
	const next = value == null ? '' : String(value)
	if (target.value === next) return
	target.value = next
}

export function bindFormModel(options: FormModelBindingOptions): Cleanup {
	const { target, kind, read, write } = options
	const readonly = options.readonly === true || isReadonlyControl(target)
	const cleanups: Cleanup[] = []
	const radio = isRadioInput(target)

	const syncEffect = new Effect(() => {
		if (radio && kind === 'checked') {
			target.checked = read() === target.value
			return
		}
		writeControlValue(target, kind, read())
	})
	cleanups.push(() => syncEffect.destroy())

	if (!readonly) {
		const event = kind === 'checked' ? 'change' : 'input'
		const listener = () => {
			if (radio && kind === 'checked') {
				if (target.checked) write(target.value)
				return
			}
			write(readControlValue(target, kind))
		}
		target.addEventListener(event, listener)
		cleanups.push(() => target.removeEventListener(event, listener))
	}

	return () => {
		for (const cleanup of cleanups) cleanup()
	}
}
