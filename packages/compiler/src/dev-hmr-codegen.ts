/** Dev-only footer appended to compiled templates for granular Vite HMR. */
export function emitDevHmrPageRegistration(
	pageUrl: string,
	options: { hasMountStateBindings: boolean; hasGetStaticPaths: boolean }
): string {
	const modProps = ['default: __aeroPageRender']
	if (options.hasGetStaticPaths) modProps.push('getStaticPaths')
	if (options.hasMountStateBindings) modProps.push('mountStateBindings')
	const modExpr = `{ ${modProps.join(', ')} }`

	return `
import { aero as __aeroDevHub, notify as __aeroDevNotify } from 'virtual:aero/runtime-hub.ts'
const __aeroDevPageUrl = ${JSON.stringify(pageUrl)}
__aeroDevHub.registerPages({ [__aeroDevPageUrl]: ${modExpr} })
if (import.meta.hot) {
	import.meta.hot.accept((m) => {
		__aeroDevHub.registerPages({ [__aeroDevPageUrl]: m })
		__aeroDevNotify()
	})
}
`
}
