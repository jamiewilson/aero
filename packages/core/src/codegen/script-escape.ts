export function escapeTemplateLiteralContent(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

export function serializeJsonForScriptTagExpression(valueExpr: string): string {
	return (
		`JSON.stringify(${valueExpr})` +
		`.replace(/</g, '\\u003C')` +
		`.replace(/>/g, '\\u003E')` +
		`.replace(/&/g, '\\u0026')` +
		`.replace(/\\//g, '\\u002F')` +
		String.raw`.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')`
	)
}
