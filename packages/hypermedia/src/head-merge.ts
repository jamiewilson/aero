export function isFullPageRegionTarget(targetSelector: string): boolean {
	const normalized = targetSelector.trim().toLowerCase()
	return normalized === 'body' || normalized === 'html' || normalized === '#app'
}

function metaIdentity(meta: HTMLMetaElement): { kind: 'name' | 'property' | 'http-equiv'; key: string } | null {
	if (meta.name) return { kind: 'name', key: meta.name }
	const property = meta.getAttribute('property')
	if (property) return { kind: 'property', key: property }
	if (meta.httpEquiv) return { kind: 'http-equiv', key: meta.httpEquiv }
	return null
}

function findExistingMeta(identity: { kind: 'name' | 'property' | 'http-equiv'; key: string }): HTMLMetaElement | null {
	if (identity.kind === 'name') {
		const found = document.querySelector(`meta[name="${identity.key}"]`)
		return found instanceof HTMLMetaElement ? found : null
	}
	if (identity.kind === 'property') {
		const found = document.querySelector(`meta[property="${identity.key}"]`)
		return found instanceof HTMLMetaElement ? found : null
	}
	const found = document.querySelector(`meta[http-equiv="${identity.key}"]`)
	return found instanceof HTMLMetaElement ? found : null
}

export function mergeHeadFromHtml(html: string): void {
	const doc = new DOMParser().parseFromString(html, 'text/html')

	const title = doc.querySelector('title')
	if (title?.textContent) {
		let existing = document.querySelector('title')
		if (!existing) {
			existing = document.createElement('title')
			document.head.appendChild(existing)
		}
		existing.textContent = title.textContent
	}

	for (const meta of doc.querySelectorAll('head meta')) {
		if (!(meta instanceof HTMLMetaElement)) continue
		const identity = metaIdentity(meta)
		if (!identity) {
			document.head.appendChild(meta.cloneNode(true))
			continue
		}

		const existing = findExistingMeta(identity)

		if (existing) {
			for (const attr of meta.getAttributeNames()) {
				existing.setAttribute(attr, meta.getAttribute(attr) ?? '')
			}
		} else {
			document.head.appendChild(meta.cloneNode(true))
		}
	}
}
