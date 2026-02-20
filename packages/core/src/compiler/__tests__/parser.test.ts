import { describe, it, expect } from 'vitest'
import { parse } from '../parser'

describe('Parser', () => {
	it('should separate is:build script, is:bundled script, and template', () => {
		const input = `
            <script is:build>
                const buildTime = true;
            </script>
            
            <h1>Title</h1>
            
            <script is:bundled>
                console.log('client');
            </script>
        `

		const result = parse(input)

		// Check Build Script
		expect(result.buildScript).toBeDefined()
		expect(result.buildScript?.content).toContain('const buildTime = true')

		// Check Client Script
		expect(result.clientScript).toBeDefined()
		expect(result.clientScript?.content).toContain("console.log('client')")

		// Check Template (should NOT contain the scripts)
		expect(result.template).toContain('<h1>Title</h1>')
		expect(result.template).not.toContain('<script is:build>')
		expect(result.template).not.toContain('<script is:bundled>')
	})

	it('should handle missing scripts', () => {
		const input = '<div>Just HTML</div>'
		const result = parse(input)

		expect(result.buildScript).toBeNull()
		expect(result.clientScript).toBeNull()
		expect(result.template).toBe('<div>Just HTML</div>')
	})

	it('should handle multiple scripts and attributes', () => {
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

	it('should leave is:inline scripts in the template', () => {
		const input = `
            <script is:build>const x = 1;</script>
            <script is:inline>console.log('inline');</script>
            <div>Content</div>
        `
		const result = parse(input)

		expect(result.buildScript?.content).toContain('const x = 1;')
		expect(result.clientScript).toBeNull()
		// is:inline script should remain in the template
		expect(result.template).toContain('<script is:inline>')
		expect(result.template).toContain("console.log('inline');")
	})

	it('should extract pass:data expression from is:bundled scripts', () => {
		const input = `
            <script is:bundled pass:data="{ { config } }">
                console.log(config);
            </script>
        `
		const result = parse(input)

		expect(result.clientScript).toBeDefined()
		expect(result.clientScript?.content).toContain('console.log(config);')
		expect(result.clientScript?.passDataExpr).toBe('{ { config } }')
	})
})
