/** Rewrite `state: bindingName` to `state: __aeroSignal("bindingName")` for owned signal refs (mount + editor). */
export function rewriteHypermediaActionStateRefs(
	handlerExpr: string,
	signalNames: ReadonlySet<string>
): string {
	if (signalNames.size === 0) return handlerExpr
	return handlerExpr.replace(
		/(\bstate\s*:\s*)([A-Za-z_$][\w$]*)/g,
		(match, prefix: string, name: string) => {
			if (!signalNames.has(name)) return match
			return `${prefix}__aeroSignal(${JSON.stringify(name)})`
		}
	)
}
