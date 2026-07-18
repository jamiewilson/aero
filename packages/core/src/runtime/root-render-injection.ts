/**
 * Root-render HTML post-processing: move trailing after </html>, inject head/scripts.
 */

import type { AeroTemplateContext } from '../types'

/**
 * Fix content after `</html>` and inject accumulated styles/scripts into the document.
 * Only applied for root-level renders (not nested components).
 */
export function applyRootRenderInjections(
	html: string,
	context: Pick<AeroTemplateContext, 'styles' | 'scripts' | 'headScripts'>
): string {
	let result = html

	// Layout returns full document; page's trailing nodes (e.g. inline scripts) can end up after </html>.
	// Move that content into the body so it isn't lost.
	if (result.includes('</html>')) {
		const afterHtml = result.split('</html>')[1]?.trim()
		if (afterHtml && result.includes('</body>')) {
			result = result.split('</html>')[0] + '</html>'
			result = result.replace('</body>', `\n${afterHtml}\n</body>`)
		}
	}

	let headInjections = ''
	if (context.styles && context.styles.size > 0) {
		headInjections += Array.from(context.styles).join('\n') + '\n'
	}
	if (context.headScripts && context.headScripts.size > 0) {
		headInjections += Array.from(context.headScripts).join('\n') + '\n'
	}

	if (headInjections) {
		if (result.includes('</head>')) {
			result = result.replace('</head>', `\n${headInjections}</head>`)
		} else if (result.includes('<body')) {
			result = result.replace(/(<body[^>]*>)/i, `<head>\n${headInjections}</head>\n$1`)
		} else {
			result = `${headInjections}${result}`
		}
	}

	if (context.scripts && context.scripts.size > 0) {
		const scriptsHtml = Array.from(context.scripts).join('\n')
		if (result.includes('</body>')) {
			result = result.replace('</body>', `\n${scriptsHtml}\n</body>`)
		} else {
			result = `${result}\n${scriptsHtml}`
		}
	}

	return result
}
