type ReactiveNotify = () => void

const proxyCache = new WeakMap<object, object>()
const rawMap = new WeakMap<object, object>()
const reactiveProxies = new WeakSet<object>()

const ARRAY_MUTATORS = new Set([
	'push',
	'pop',
	'splice',
	'shift',
	'unshift',
	'sort',
	'reverse',
	'fill',
])

function isPlainObject(value: object): boolean {
	const proto = Object.getPrototypeOf(value)
	return proto === Object.prototype || proto === null
}

function isReactiveable(value: unknown): value is object {
	if (value === null || typeof value !== 'object') return false
	if (isReactive(value)) return false
	if (Array.isArray(value)) return true
	if (value instanceof Map || value instanceof Set) return true
	return isPlainObject(value)
}

export function isReactive(value: unknown): boolean {
	return typeof value === 'object' && value !== null && reactiveProxies.has(value)
}

export function toRaw<T>(value: T): T {
	if (typeof value !== 'object' || value === null) return value
	const raw = rawMap.get(value as object)
	return (raw ?? value) as T
}

function cacheProxy<T extends object>(target: T, proxy: T): T {
	proxyCache.set(target, proxy)
	rawMap.set(proxy, target)
	reactiveProxies.add(proxy)
	return proxy
}

function wrapNested(value: unknown, notify: ReactiveNotify): unknown {
	return isReactiveable(value) ? makeReactive(value, notify) : value
}

function createObjectProxy<T extends object>(target: T, notify: ReactiveNotify): T {
	const proxy = new Proxy(target, {
		get(obj, key, receiver) {
			const value = Reflect.get(obj, key, receiver)
			if (typeof key === 'string' && ARRAY_MUTATORS.has(key) && typeof value === 'function') {
				return (...args: unknown[]) => {
					const result = (value as (...a: unknown[]) => unknown).apply(obj, args)
					notify()
					return result
				}
			}
			return wrapNested(value, notify)
		},
		set(obj, key, value, receiver) {
			const old = Reflect.get(obj, key, receiver)
			const next = isReactiveable(value) ? makeReactive(value, notify) : value
			if (Object.is(old, next)) return true
			Reflect.set(obj, key, next, receiver)
			notify()
			return true
		},
		deleteProperty(obj, key) {
			if (!Reflect.has(obj, key)) return true
			Reflect.deleteProperty(obj, key)
			notify()
			return true
		},
	})
	return cacheProxy(target, proxy)
}

function createMapProxy(map: Map<unknown, unknown>, notify: ReactiveNotify): Map<unknown, unknown> {
	const proxy = new Proxy(map, {
		get(target, prop, receiver) {
			if (prop === 'get') {
				return (key: unknown) => wrapNested(target.get(key), notify)
			}
			if (prop === 'set' || prop === 'delete' || prop === 'clear') {
				const method = Reflect.get(target, prop, receiver) as (...args: unknown[]) => unknown
				return (...args: unknown[]) => {
					let changed = true
					if (prop === 'set') {
						const [key, value] = args
						changed = !Object.is(target.get(key), value)
						if (changed && isReactiveable(value)) {
							args = [key, makeReactive(value, notify)]
						}
					} else if (prop === 'delete') {
						changed = target.has(args[0])
					} else if (prop === 'clear') {
						changed = target.size > 0
					}
					const result = method.apply(target, args)
					if (changed) notify()
					return result
				}
			}
			if (prop === 'size') {
				return target.size
			}
			const value = Reflect.get(target, prop, receiver)
			return typeof value === 'function' ? value.bind(target) : value
		},
	})
	return cacheProxy(map, proxy)
}

function createSetProxy(set: Set<unknown>, notify: ReactiveNotify): Set<unknown> {
	const proxy = new Proxy(set, {
		get(target, prop, receiver) {
			if (prop === 'add' || prop === 'delete' || prop === 'clear') {
				const method = Reflect.get(target, prop, receiver) as (...args: unknown[]) => unknown
				return (...args: unknown[]) => {
					let changed = true
					if (prop === 'add') {
						changed = !target.has(args[0])
					} else if (prop === 'delete') {
						changed = target.has(args[0])
					} else if (prop === 'clear') {
						changed = target.size > 0
					}
					const result = method.apply(target, args)
					if (changed) notify()
					return result
				}
			}
			if (prop === 'size') {
				return target.size
			}
			const value = Reflect.get(target, prop, receiver)
			return typeof value === 'function' ? value.bind(target) : value
		},
	})
	return cacheProxy(set, proxy)
}

export function makeReactive<T>(value: T, notify: ReactiveNotify): T {
	if (!isReactiveable(value)) return value
	const cached = proxyCache.get(value)
	if (cached) return cached as T
	if (value instanceof Map) return createMapProxy(value, notify) as T
	if (value instanceof Set) return createSetProxy(value, notify) as T
	return createObjectProxy(value, notify) as T
}
