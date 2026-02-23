# HTMX and Alpine.js

Aero leaves `hx-*` (HTMX) and `x-*` / `:` / `@` / `.` (Alpine) attributes unchanged in your templates, so you can use both libraries directly. This doc covers setup, basics, and using them together.

## HTMX

htmx extends HTML with attributes that trigger HTTP requests.

### Basics

```html
<button hx-get="/api/hello" hx-target="#result" hx-swap="innerHTML">Load Message</button>
<div id="result"></div>

<form hx-post="/api/submit" hx-target="#response" hx-swap="outerHTML">
	<input type="text" name="message" placeholder="Enter message" />
	<button type="submit">Submit</button>
</form>
<div id="response"></div>
```

### Core attributes

| Attribute      | Description                                              |
| -------------- | -------------------------------------------------------- |
| `hx-get`, `hx-post`, `hx-put`, `hx-patch`, `hx-delete` | HTTP method and URL |
| `hx-target`    | CSS selector for where to swap the response              |
| `hx-swap`      | How to swap: `innerHTML`, `outerHTML`, `beforeend`, etc. |
| `hx-trigger`   | Event that triggers the request (default: click/change)  |
| `hx-indicator` | Element to show during request (loading state)           |
| `hx-confirm`   | Show confirmation dialog before request                  |

### Advanced triggers

```html
<input type="search" name="q" hx-get="/api/search" hx-trigger="keyup changed delay:500ms" hx-target="#search-results" placeholder="Search..." />
<div hx-get="/api/lazy-content" hx-trigger="revealed" hx-swap="outerHTML">Loading...</div>
<div hx-get="/api/notifications" hx-trigger="every 5s">Notifications here</div>
```

### Server handlers (Nitro)

Return HTML fragments from API handlers:

```typescript
// server/api/submit.post.ts
import { defineHandler, readBody } from 'nitro/h3'

export default defineHandler(async event => {
	const body = await readBody(event)
	return `<div id="response" class="success">Message received: ${body.message}</div>`
})
```

Out-of-band swaps: include `hx-swap-oob="true"` in response elements to update multiple targets from one response.

---

## Alpine.js

Alpine.js provides reactive, declarative behavior in HTML.

### Setup

Import and start Alpine (and optionally htmx) in your main client script:

```typescript
// e.g. client/assets/scripts/index.ts
import Alpine from 'alpinejs'
import 'htmx.org'  // optional

window.Alpine = Alpine
Alpine.start()
```

### Basic usage

```html
<div x-data="{ count: 0 }">
	<button @click="count++">Increment</button>
	<span x-text="count"></span>
</div>

<div x-data="{ open: false }">
	<button @click="open = !open">Toggle</button>
	<div x-show="open" x-transition>Content</div>
</div>

<div x-data="{ name: '' }">
	<input type="text" x-model="name" placeholder="Your name" />
	<p>Hello, <span x-text="name || 'stranger'"></span>!</p>
</div>
```

### Core directives

| Directive      | Description                         |
| -------------- | ----------------------------------- |
| `x-data`       | Reactive data scope                 |
| `x-bind` / `:attr` | Bind attributes reactively    |
| `x-on` / `@event` | Event listeners                 |
| `x-text`, `x-html` | Text or HTML content           |
| `x-model`      | Two-way binding for inputs         |
| `x-show`, `x-if` | Visibility and conditional render |
| `x-for`        | Loop over items                     |
| `x-transition` | CSS transitions                     |
| `x-init`       | Run on init                         |

### Reusable components and store

Register with `Alpine.data('name', () => ({ ... }))` and use `x-data="name"`. Use `Alpine.store('key', { ... })` for global state and `$store.key` in templates.

---

## Using HTMX and Alpine together

Use htmx for server communication and Alpine for client interactivity. When htmx swaps in new HTML, Alpine components in that content must be initialized.

### Initialize Alpine after htmx swaps

```typescript
// client/assets/scripts/index.ts
import htmx from 'htmx.org'
import Alpine from 'alpinejs'

htmx.onLoad(content => {
	Alpine.initTree(content)
})

window.Alpine = Alpine
window.htmx = htmx
Alpine.start()
```

### Example: form with loading state

```html
<form
	x-data="{ submitting: false }"
	hx-post="/api/register"
	hx-target="#form-result"
	hx-indicator=".spinner"
	@htmx:before-request="submitting = true"
	@htmx:after-request="submitting = false">
	<input type="email" name="email" />
	<button type="submit" :disabled="submitting">
		<span x-show="!submitting">Register</span>
		<span x-show="submitting" class="spinner">Loading...</span>
	</button>
</form>
<div id="form-result"></div>
```

### Example: live search

```html
<div x-data="{ loading: false, query: '' }">
	<input type="search" x-model="query" hx-get="/api/search" hx-trigger="keyup changed delay:300ms" hx-target="#results" hx-indicator="#search-loading" name="q" placeholder="Search..." />
	<div id="search-loading" x-show="loading" class="htmx-indicator">Searching...</div>
	<div id="results"></div>
</div>
```
