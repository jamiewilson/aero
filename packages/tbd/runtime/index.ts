import type { MountOptions } from '../types'

export class TBD {
	private globals: Record<string, any> = {}
	private pagesMap: Record<string, any> = {}
	mount?: (options?: MountOptions) => Promise<void>

	global(name: string, value: any) {
		this.globals[name] = value
	}

	registerPages(pages: Record<string, any>) {
		for (const [path, mod] of Object.entries(pages)) {
			const withoutExt = path.replace(/\.html$/, '').replace(/\\/g, '/')
			const key = withoutExt.includes('pages/')
				? withoutExt.split('pages/').pop()!
				: withoutExt.split('/').filter(Boolean).length > 1
					? withoutExt.split('/').filter(Boolean).join('/')
					: withoutExt.split('/').pop() || path
			this.pagesMap[key] = mod
			this.pagesMap[path] = mod
		}
	}

	async render(component: any, props: any = {}) {
		const context = {
			...this.globals,
			props,
			slots: {}, // Ensure slots exists even for top-level pages
			renderComponent: this.renderComponent.bind(this),
		}

		let target = component
		if (typeof component === 'string') {
			target = this.pagesMap[component]

			// Fallback: If not found, try as directory index (e.g. /docs -> docs/index)
			if (!target) {
				target = this.pagesMap[`${component}/index`]
			}
			// Fallback: If index is not found, try home
			if (!target && component === 'index') {
				target = this.pagesMap['home']
			}
		}

		if (!target) {
			return `Page not found: ${component}`
		}

		// Handle lazy-loaded modules (Vite import.meta.glob without eager)
		// Lazy loaders are () => import(...), while render functions are tbd => ...
		if (typeof target === 'function' && target.length === 0) {
			target = await target()
		}

		// Handle module objects
		if (target.default) target = target.default

		if (typeof target === 'function') {
			return await target(context)
		}

		return ''
	}

	async renderComponent(component: any, props: any = {}, slots: Record<string, string> = {}) {
		const context = {
			...this.globals,
			props,
			slots,
			renderComponent: this.renderComponent.bind(this),
		}

		if (typeof component === 'function') {
			return await component(context)
		}

		// If it's the module object itself
		if (component && typeof component.default === 'function') {
			return await component.default(context)
		}

		return ''
	}
}
