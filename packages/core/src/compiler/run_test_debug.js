import { parse } from './parser.js'
import { compile } from './codegen.js'

const html = `<script on:build>
const theme = { fg: 'white', bg: 'black' };
</script>
<style pass:data="{ { theme } }">
body { color: var(--theme); }
</style>`

const parsed = parse(html)
const options = { root: '/', resolvePath: (v) => v }
const code = compile(parsed, options)
console.log(code)
