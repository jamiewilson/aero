const currentClass = 'current'
const linkSelector = '[data-toc-link]'

const linksById = new Map(
	[...document.querySelectorAll(linkSelector)]
		.map(link => [link.hash.slice(1), link])
		.filter(([id]) => id)
)

const headings = [...linksById.keys()].map(id => document.getElementById(id)).filter(Boolean)
let currentLink = null

const setCurrent = id => {
	if (!id) {
		currentLink?.classList.remove(currentClass)
		currentLink = null
		return
	}

	const nextLink = linksById.get(id)
	if (!nextLink || nextLink === currentLink) return
	currentLink?.classList.remove(currentClass)
	nextLink.classList.add(currentClass)
	currentLink = nextLink
}

const getActiveHeadingId = () => {
	if (!headings.length) return ''

	const scrollY = window.scrollY + window.innerHeight * 0.25
	let activeId = ''

	for (const heading of headings) {
		if (!heading.id) continue
		if (heading.offsetTop <= scrollY) {
			activeId = heading.id
		} else {
			break
		}
	}

	return activeId
}

let isTicking = false
const updateCurrent = () => {
	isTicking = false
	setCurrent(getActiveHeadingId())
}

const scheduleUpdate = () => {
	if (isTicking) return
	isTicking = true
	requestAnimationFrame(updateCurrent)
}

window.addEventListener('scroll', scheduleUpdate, { passive: true })
window.addEventListener('resize', scheduleUpdate)
window.addEventListener('hashchange', scheduleUpdate)

scheduleUpdate()
