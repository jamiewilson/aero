/**
 * Ambient declaration for the content module `@content/site`.
 * Used for type-checking when the build or tests reference this import (e.g. core's parser tests).
 * Apps typically resolve @content/site to their own content/site.ts via path aliases.
 */
declare module '@content/site' {
	const site: any
	export default site
}
