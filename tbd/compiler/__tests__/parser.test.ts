import { describe, it, expect } from 'vitest'
import { parse } from '@tbd/compiler/parser'

describe('Parser', () => {
	it('should separate on:build script, on:client script, and template', () => {
		const input = `
            <script on:build>
                const buildTime = true;
            </script>
            
            <h1>Title</h1>
            
            <script on:client>
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
		expect(result.template).not.toContain('<script on:build>')
		expect(result.template).not.toContain('<script on:client>')
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
            <script on:build type="module">const a = 1;</script>
            <script on:build id="second">const b = 2;</script>
            <div>Content</div>
        `
		const result = parse(input)

		expect(result.buildScript?.content).toContain('const a = 1;')
		expect(result.buildScript?.content).toContain('const b = 2;')
		expect(result.template).toBe('<div>Content</div>')
	})
})
