import { describe, it, expect } from 'vitest'
import { parse } from '../parser'

describe('Parser (V2 Taxonomy)', () => {
	it('should categorize script correctly based on taxonomy', () => {
		const input = `
            <script is:build>
                const buildTime = true;
            </script>
            
            <h1>Title</h1>
            
            <script>
                console.log('client bundled default');
            </script>
        `

		const result = parse(input)

		// Check Build Script
		expect(result.buildScript).toBeDefined()
		expect(result.buildScript?.content).toContain('const buildTime = true')

		// Check Client Script (default)
		expect(result.clientScripts).toBeDefined()
		expect(result.clientScripts).toHaveLength(1)
		expect(result.clientScripts[0].content).toContain("console.log('client bundled default')")

		// Check Template (should NOT contain the extracted scripts)
		expect(result.template).toContain('<h1>Title</h1>')
		expect(result.template).not.toContain('<script is:build>')
		expect(result.template).not.toContain('<script>')
	})

	it('should handle missing scripts', () => {
		const input = '<div>Just HTML</div>'
		const result = parse(input)

		expect(result.buildScript).toBeNull()
		expect(result.clientScripts).toHaveLength(0)
		expect(result.template).toBe('<div>Just HTML</div>')
	})

	it('should merge multiple is:build scripts', () => {
		const input = `
            <script is:build type="module">const a = 1;</script>
            <script is:build id="second">const b = 2;</script>
            <div>Content</div>
        `
		const result = parse(input)

		expect(result.buildScript?.content).toContain('const a = 1;')
		expect(result.buildScript?.content).toContain('const b = 2;')
		expect(result.template).toBe('<div>Content</div>')
	})

	it('should not extract scripts inside HTML comments', () => {
		const input = `
            <!--<script is:build>const commented = true;</script>-->
            <div>Content</div>
        `
		const result = parse(input)

		expect(result.buildScript).toBeNull()
		expect(result.template).toContain('<!--')
		expect(result.template).toContain('<div>Content</div>')
	})

	it('should retain is:inline tags in the template exactly where they are', () => {
		const input = `
            <script is:build>const x = 1;</script>
            <script is:inline>console.log('inline');</script>
            <div>Content</div>
        `
		const result = parse(input)

		expect(result.buildScript?.content).toContain('const x = 1;')
		expect(result.clientScripts).toHaveLength(0)

		// is:inline script should be tracked
		expect(result.inlineScripts).toBeDefined()
		expect(result.inlineScripts).toHaveLength(1)
		expect(result.inlineScripts[0].content).toContain("console.log('inline');")

		// AND it should remain in the template (but directives stripped)
		expect(result.template).toContain("<script>console.log('inline');</script>")
	})

	it('should hoist is:blocking scripts to the head', () => {
		const input = `
            <script is:blocking>console.log('head');</script>
            <div>Content</div>
        `
		const result = parse(input)

		expect(result.blockingScripts).toHaveLength(1)
		expect(result.blockingScripts[0].content).toContain("console.log('head');")

		// Must be removed from body template
		expect(result.template).not.toContain('<script')
		expect(result.template).toContain('<div>Content</div>')
	})

	it('should extract pass:data expression from explicit and default scripts', () => {
		const input = `
            <script pass:data="{ { config } }">
                console.log(config);
            </script>
        `
		const result = parse(input)

		expect(result.clientScripts).toHaveLength(1)
		expect(result.clientScripts[0].content).toContain('console.log(config);')
		expect(result.clientScripts[0].passDataExpr).toBe('{ { config } }')
	})

	it('should extract pass:data expression from is:inline scripts', () => {
		const input = `
            <script is:inline pass:data="{ { config } }">
                console.log(config);
            </script>
        `
		const result = parse(input)

		expect(result.inlineScripts).toHaveLength(1)
		expect(result.inlineScripts[0].content).toContain('console.log(config);')
		expect(result.inlineScripts[0].passDataExpr).toBe('{ { config } }')
		// The retained tag should preserve pass:data for codegen to process interpolation
		expect(result.template).toContain('pass:data')
	})

	it('should leave scripts in head in place and not extract them', () => {
		const input = `
<html>
<head>
	<script src="external.js"></script>
	<script pass:data="{ { theme } }">
		console.log(theme);
	</script>
</head>
<body>
	<h1>Title</h1>
</body>
</html>
        `
		const result = parse(input)

		// Script with src should stay in place
		expect(result.template).toContain('src="external.js"')
		// Script with pass:data in head should also stay in place (not extracted to clientScripts)
		expect(result.template).toContain('pass:data')
		expect(result.template).toContain('console.log(theme);')
		// Should NOT be extracted to clientScripts
		expect(result.clientScripts).toHaveLength(0)
	})

	it('should extract body scripts without is:* attributes as client scripts', () => {
		const input = `
<html>
<head>
	<script src="external.js"></script>
</head>
<body>
	<script pass:data="{ { theme } }">
		console.log(theme);
	</script>
</body>
</html>
        `
		const result = parse(input)

		// Script in body should be extracted to clientScripts
		expect(result.clientScripts).toHaveLength(1)
		expect(result.clientScripts[0].content).toContain('console.log(theme);')
		// Should NOT be in template
		expect(result.template).not.toContain('console.log(theme);')
	})

	it('should remove extracted scripts by index even when HTML comment inside script (cleaned vs original would differ)', () => {
		// Previously we matched on cleaned HTML but removed from original: fullTag from cleaned
		// would not appear in original, so template.replace(fullTag, '') did nothing.
		const input = `
<script is:build>
<!-- inline html comment -->
	const x = 1;
</script>
<div>Content</div>
`
		const result = parse(input)

		expect(result.buildScript?.content).toContain('const x = 1;')
		expect(result.template).not.toContain('<script')
		expect(result.template).toContain('<div>Content</div>')
	})

	// Baseline for home.html-style page: is:build, is:inline, external src, is:blocking, script src= (no default client scripts)
	it('should produce no clientScripts when all scripts are is:build, is:inline, is:blocking, or have src', () => {
		const input = `
<script is:build>
	const x = 1;
</script>
<base-layout>
	<header-component />
</base-layout>
<script is:inline>console.debug('inline');</script>
<script src="https://unpkg.com/something.js"></script>
<script is:inline type="module">import { y } from '@scripts/utils'; console.debug(y);</script>
<script is:blocking>console.debug('blocking');</script>
<script src="@scripts/module.ts"></script>
`
		const result = parse(input)

		expect(result.buildScript?.content).toContain('const x = 1;')
		expect(result.clientScripts).toHaveLength(0)
		expect(result.blockingScripts).toHaveLength(1)
		expect(result.blockingScripts[0].content).toContain("console.debug('blocking');")
		// is:inline and script src= remain in template
		expect(result.template).toContain("console.debug('inline');")
		expect(result.template).toContain('https://unpkg.com/something.js')
		expect(result.template).toContain('@scripts/module.ts')
	})
})
