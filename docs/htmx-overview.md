### htmx Overview

htmx extends HTML with attributes that trigger HTTP requests:

```html
<!-- GET request, swap response into #result -->
<button hx-get="/api/hello" hx-target="#result" hx-swap="innerHTML">Load Message</button>
<div id="result"></div>

<!-- POST request with form data -->
<form hx-post="/api/submit" hx-target="#response" hx-swap="outerHTML">
	<input type="text" name="message" placeholder="Enter message" />
	<button type="submit">Submit</button>
</form>
<div id="response"></div>
```

### Core htmx Attributes

| Attribute      | Description                                              |
| -------------- | -------------------------------------------------------- |
| `hx-get`       | Issue a GET request to the URL                           |
| `hx-post`      | Issue a POST request to the URL                          |
| `hx-put`       | Issue a PUT request to the URL                           |
| `hx-patch`     | Issue a PATCH request to the URL                         |
| `hx-delete`    | Issue a DELETE request to the URL                        |
| `hx-target`    | CSS selector for where to swap the response              |
| `hx-swap`      | How to swap: `innerHTML`, `outerHTML`, `beforeend`, etc. |
| `hx-trigger`   | Event that triggers the request (default: click/change)  |
| `hx-indicator` | Element to show during request (loading state)           |
| `hx-confirm`   | Show confirmation dialog before request                  |

### Advanced Triggers

```html
<!-- Trigger on keyup with 500ms debounce -->
<input
	type="search"
	name="q"
	hx-get="/api/search"
	hx-trigger="keyup changed delay:500ms"
	hx-target="#search-results"
	placeholder="Search..." />
<div id="search-results"></div>

<!-- Trigger when element enters viewport -->
<div hx-get="/api/lazy-content" hx-trigger="revealed" hx-swap="outerHTML">Loading...</div>

<!-- Polling every 5 seconds -->
<div hx-get="/api/notifications" hx-trigger="every 5s">Notifications will appear here</div>
```

### Creating Server Handlers for htmx

Nitro handlers should return HTML fragments for htmx requests:

```typescript
// server/api/search.get.ts
import { defineHandler, getQuery } from 'nitro/h3'

export default defineHandler(event => {
	const { q } = getQuery(event)

	// Return HTML fragment
	return `
		<ul>
			<li>Result for: ${q}</li>
			<li>Another result</li>
		</ul>
	`
})
```

```typescript
// server/api/submit.post.ts
import { defineHandler, readBody } from 'nitro/h3'

export default defineHandler(async event => {
	const body = await readBody(event)

	return `
		<div id="response" class="success">
			Message received: ${body.message}
		</div>
	`
})
```

### Out-of-Band Swaps

Update multiple elements from a single response:

```typescript
// server/api/update-multiple.post.ts
import { defineHandler } from 'nitro/h3'

export default defineHandler(() => {
	return `
		<div id="main-content">Updated main content</div>
		<div id="sidebar" hx-swap-oob="true">Updated sidebar</div>
		<div id="notification" hx-swap-oob="true">Success!</div>
	`
})
```
