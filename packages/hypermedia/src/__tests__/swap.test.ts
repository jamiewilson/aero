import { describe, expect, it } from 'vitest'
import { performSwap, performSwaps, resolveTarget, parseSwapStyle, resolveSwapProcessContainer } from '../swap'
import type { SwapOperation } from '../types'

function createContainer(): { container: HTMLElement; target: HTMLElement } {
	const container = document.createElement('div')
	container.innerHTML = '<div id="target">original</div><div id="other">other</div>'
	const target = container.querySelector('#target') as HTMLElement
	return { container, target }
}

describe('resolveTarget', () => {
	it('finds element by selector', () => {
		const { container } = createContainer()
		const el = resolveTarget('#target', container)
		expect(el).not.toBeNull()
		expect(el!.textContent).toBe('original')
	})

	it('returns null for missing selector', () => {
		const { container } = createContainer()
		expect(resolveTarget('#nonexistent', container)).toBeNull()
	})
})

describe('parseSwapStyle', () => {
	it('parses valid swap styles', () => {
		expect(parseSwapStyle('innerHTML')).toBe('innerHTML')
		expect(parseSwapStyle('outerHTML')).toBe('outerHTML')
		expect(parseSwapStyle('beforebegin')).toBe('beforebegin')
		expect(parseSwapStyle('afterbegin')).toBe('afterbegin')
		expect(parseSwapStyle('beforeend')).toBe('beforeend')
		expect(parseSwapStyle('afterend')).toBe('afterend')
		expect(parseSwapStyle('replace')).toBe('replace')
		expect(parseSwapStyle('remove')).toBe('remove')
		expect(parseSwapStyle('none')).toBe('none')
	})

	it('is case insensitive', () => {
		expect(parseSwapStyle('INNERHTML')).toBe('innerHTML')
		expect(parseSwapStyle('OuterHTML')).toBe('outerHTML')
		expect(parseSwapStyle('REPLACE')).toBe('replace')
		expect(parseSwapStyle('REMOVE')).toBe('remove')
		expect(parseSwapStyle('NONE')).toBe('none')
	})

	it('returns null for invalid styles', () => {
		expect(parseSwapStyle('morph')).toBeNull()
		expect(parseSwapStyle('')).toBeNull()
	})
})

describe('resolveSwapProcessContainer', () => {
	it('returns the connected target for innerHTML swaps', () => {
		const { container, target } = createContainer()
		document.body.append(container)
		performSwap({ target, html: '<button>next</button>', style: 'innerHTML' })
		const processTarget = resolveSwapProcessContainer(target, 'innerHTML', '#target', container)
		expect(processTarget).toBe(target)
		expect(processTarget).toBe(container.querySelector('#target'))
	})

	it('returns the replacement node after outerHTML swaps', () => {
		const { container, target } = createContainer()
		document.body.append(container)
		const inserted = performSwap({
			target,
			html: '<div id="target"><button>next</button></div>',
			style: 'outerHTML',
		})
		const processTarget = resolveSwapProcessContainer(target, 'outerHTML', '#target', container, inserted)
		expect(target.isConnected).toBe(false)
		expect(processTarget).toBe(container.querySelector('#target'))
		expect(processTarget).not.toBe(target)
	})

	it('returns inserted node when outerHTML changes the id', () => {
		const { container, target } = createContainer()
		document.body.append(container)
		const inserted = performSwap({
			target,
			html: '<span id="fragment-status">replaced</span>',
			style: 'outerHTML',
		})
		const processTarget = resolveSwapProcessContainer(
			target,
			'outerHTML',
			'#target',
			container,
			inserted
		)
		expect(target.isConnected).toBe(false)
		expect(processTarget).toBe(container.querySelector('#fragment-status'))
		expect(processTarget).not.toBe(document.body)
	})
})

describe('performSwap', () => {
	it('replaces innerHTML', () => {
		const { container, target } = createContainer()
		performSwap({ target, html: '<span>replaced</span>', style: 'innerHTML' })
		expect(target.innerHTML).toBe('<span>replaced</span>')
	})

	it('replaces outerHTML', () => {
		const { container, target } = createContainer()
		const parent = target.parentElement!
		performSwap({ target, html: '<div id="new">new</div>', style: 'outerHTML' })
		expect(parent.querySelector('#target')).toBeNull()
		expect(parent.querySelector('#new')).not.toBeNull()
	})

	it('inserts beforebegin', () => {
		const { container, target } = createContainer()
		performSwap({ target, html: '<div id="before">before</div>', style: 'beforebegin' })
		const prev = target.previousElementSibling
		expect(prev?.id).toBe('before')
	})

	it('inserts afterbegin', () => {
		const { container, target } = createContainer()
		performSwap({ target, html: '<span>first</span>', style: 'afterbegin' })
		expect(target.firstElementChild?.textContent).toBe('first')
	})

	it('inserts beforeend', () => {
		const { container, target } = createContainer()
		performSwap({ target, html: '<span>last</span>', style: 'beforeend' })
		expect(target.lastElementChild?.textContent).toBe('last')
	})

	it('inserts afterend', () => {
		const { container, target } = createContainer()
		performSwap({ target, html: '<div id="after">after</div>', style: 'afterend' })
		const next = target.nextElementSibling
		expect(next?.id).toBe('after')
	})

	it('replace morphs in place preserving matched ids', () => {
		const { container, target } = createContainer()
		document.body.append(container)
		target.innerHTML = '<input id="keep" value="typed">'
		const input = target.querySelector('#keep') as HTMLInputElement
		input.focus()
		input.value = 'typed'

		performSwap({
			target,
			html: '<div id="target"><input id="keep" value="server"><span>added</span></div>',
			style: 'replace',
		})

		expect(container.querySelector('#target')).toBe(target)
		expect(input.value).toBe('typed')
		expect(target.querySelector('span')?.textContent).toBe('added')
	})

	it('replace skips nodes marked data-aero-ignore-morph', () => {
		const { container, target } = createContainer()
		document.body.append(container)
		target.innerHTML = '<span id="locked" data-aero-ignore-morph>stay</span>'

		performSwap({
			target,
			html: '<div id="target"><span id="locked" data-aero-ignore-morph>changed</span></div>',
			style: 'replace',
		})

		expect(target.querySelector('#locked')?.textContent).toBe('stay')
	})

	it('remove removes target element', () => {
		const { container, target } = createContainer()
		performSwap({ target, html: '', style: 'remove' })
		expect(container.querySelector('#target')).toBeNull()
	})

	it('none does nothing', () => {
		const { container, target } = createContainer()
		performSwap({ target, html: '<span>ignored</span>', style: 'none' })
		expect(target.textContent).toBe('original')
	})

	it('throws for unknown swap style', () => {
		const { target } = createContainer()
		expect(() => performSwap({ target, html: 'x', style: 'morph' as never })).toThrow()
	})
})

describe('performSwaps', () => {
	it('applies multiple swaps in order', () => {
		const container = document.createElement('div')
		container.innerHTML = '<div id="a">a</div><div id="b">b</div>'
		const a = container.querySelector('#a') as HTMLElement
		const b = container.querySelector('#b') as HTMLElement

		const ops: SwapOperation[] = [
			{ target: a, html: 'A', style: 'innerHTML' },
			{ target: b, html: 'B', style: 'innerHTML' },
		]
		performSwaps(ops)
		expect(a.textContent).toBe('A')
		expect(b.textContent).toBe('B')
	})
})
