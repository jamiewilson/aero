# aero-lume

Bare-bones Aero + [Lume](https://github.com/sathvikc/lume-js) example for client-side data binding.

## Commands

| Command        | Description            |
| -------------- | ---------------------- |
| `pnpm dev`     | Start the dev server   |
| `pnpm build`   | Build for production   |
| `pnpm preview` | Preview the built site |

## What this example shows

- Aero renders a single page and layout.
- Lume manages a tiny reactive store in the browser.
- `data-bind` keeps the input and text in sync.
- `data-show` reveals the greeting once a name is entered.

## Project structure

```
aero-lume/
├── client/
│   ├── assets/
│   │   ├── scripts/index.js
│   │   └── styles/global.css
│   └── pages/index.html
├── vite.config.ts
└── tsconfig.json
```

## Core pieces

The page template outputs plain HTML with Lume's `data-*` attributes:

```html
<h1 data-show="name" hidden>Hello, <span data-bind="name"></span>!</h1>
<input data-bind="name" placeholder="Enter your name" />
```

The client entry binds that DOM to a reactive store:

```js
import aero from '@aero-js/core'
import { state, bindDom } from 'lume-js'
import { show } from 'lume-js/handlers'

const store = state({ name: '' })

aero.mount({
	onRender(el) {
		bindDom(el, store, {
			handlers: [show],
		})
	},
})
```

That is the entire example: one page, one layout, one script, and one stylesheet.

This keeps Aero responsible for structure and build-time data, and Lume for browser-only reactivity, with a clear split and no conflict between the two.
