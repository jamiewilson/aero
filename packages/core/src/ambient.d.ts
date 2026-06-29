/**
 * Ambient declaration for the content module `@content/site.ts`.
 * Used for type-checking when the build or tests reference this import (e.g. core's parser tests).
 * Apps resolve `@content/site.ts` to their own `content/site.ts` via path aliases.
 */
declare module '@content/site.ts' {
	const site: any
	export default site
}
