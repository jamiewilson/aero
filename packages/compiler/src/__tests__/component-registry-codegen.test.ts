import { describe, it, expect } from 'vitest'
import { renderComponentRegistryDts } from '../component-registry-codegen'

describe('renderComponentRegistryDts', () => {
	it('emits namespaced types and registry entries', () => {
		const dts = renderComponentRegistryDts([
			{
				relPath: '/x/site-header.html',
				tag: 'site-header',
				namespaceId: '__tag_site_header',
				propsTypeName: 'HeaderProps',
				typeDeclarationText: 'interface HeaderProps { title: string }',
			},
		])
		expect(dts).toContain(`declare namespace AeroRegistryGenerated`)
		expect(dts).toContain(`export namespace __tag_site_header`)
		expect(dts).toContain(`interface HeaderProps`)
		expect(dts).toContain(
			`'site-header': { props: AeroRegistryGenerated.__tag_site_header.HeaderProps }`
		)
	})
})
