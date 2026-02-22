Script debug session notes:

## From home.html:

```html
<!-- Should be bundled/module & hoisted to bottom by defualt -->
<!-- How should we handle import src path resolution? -->
<script>
	import { allCaps } from '@scripts/utils/transform'
	const message = allCaps('[aero] PLAIN <script type="module">')
	console.debug(message)
</script>

<script src="https://unpkg.com/js-hello-world/helloWorld.js"></script>

<script is:blocking>
	console.debug('[AERO] <script is:blocking> moved to <head>')
</script>

<!-- FIXME [CORE]: should be bundled/module by defualt -->
<script src="@scripts/module.ts"></script>
<script async src="@scripts/async.ts"></script>
<script defer src="@scripts/defer.ts"></script>
```

## From header.html:

```html
<script pass:data="{{ isHomepage }}">
	import { allCaps } from '@scripts/utils/transform'
	// This comment will get stripped from build output
	console.debug(allCaps('[aero]'), 'isHomepage', isHomepage)
</script>

<script is:inline pass:data="{{ isHomepage }}">
	console.debug('[aero] isHomepage', isHomepage)
</script>
```

## DEV OUTPUT:

```html
<!-- if the orginal script tag has type="module", it gets bundled by vite? The generated src is different than the other module below -->
<script type="module" src="/@id/__x00__/index.html?html-proxy&index=0.js"></script>

<!-- If it's a plain script tag, it's incorreclty not getting bundled  -->
<!-- console: Uncaught SyntaxError: Cannot use import statement outside a module -->
<!-- src path is not resolved -->
<script>
	import { allCaps } from '@scripts/utils/transform'
	const message = allCaps('[aero] PLAIN <script type="module">')
	console.debug(message)
</script>

<script src="https://unpkg.com/js-hello-world/helloWorld.js"></script>

<!-- Why are these not @aero paths in dev? What's different about them? Do we lose HMR if they are not @aero paths?-->
<script src="/client/assets/scripts/module.ts" type="module"></script>
<script async="" src="/client/assets/scripts/async.ts" type="module"></script>
<script defer="" src="/client/assets/scripts/defer.ts" type="module"></script>

<!-- from header.html -->
<script type="application/json" id="__aero_data" class="__aero_data">
	{ "isHomepage": true }
</script>
<script type="module" src="/@aero/client/client/components/header.js"></script>
```

## AND dev output for @aero/client/client/components/header.js:

```js
const { isHomepage } = JSON.parse((document.getElementById('__aero_data') || document.querySelector('.__aero_data'))?.textContent || '{}');
import { allCaps } from "/client/assets/scripts/utils/transform.ts"
	// This comment will get stripped from build output
	console.debug(allCaps('[aero]'), 'isHomepage', isHomepage)
```

Also of note, comments are preserved in the output.

## BUILD OUTPUT:

```html
<!-- From header.html -->
<script>{const e=!0;console.debug("[aero] isHomepage",e)}</script>

<!-- From home.html, not being bundled -->
<!-- without type="module -->
<script>
	import { allCaps } from '@scripts/utils/transform'
	const message = allCaps('[aero] PLAIN <script type="module">')
	console.debug(message)
</script>

<script src="https://unpkg.com/js-hello-world/helloWorld.js"></script>
<script src="./assets/module.ts-Dex-cO3I.js" type="module"></script>
<script async src="./assets/async.ts-DBa8KdkH.js" type="module"></script>

<!-- What's the story with "=defer" getting added? -->
<script defer="defer" src="./assets/defer.ts-C4WtOH2X.js" type="module"></script>


<!-- Build output for header.html -->
<!-- we probably don't need id and class attributes here? -->
<script type="application/json" id="__aero_data" class="__aero_data">
	{ "isHomepage": true }
</script>

<!-- import src is not processed so it doesn't work in browser -->
<!-- isHomepage from __aero_data is not available here -->
<!-- Uncaught ReferenceError: isHomepage is not defined -->
<script type="module">
	import { allCaps } from '@scripts/utils/transform'
	console.debug(allCaps('[aero]'), 'isHomepage', isHomepage)
</script>
```
