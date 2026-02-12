## Combining htmx + Alpine.js

htmx and Alpine work beautifully together. Use htmx for server communication and Alpine for client-side interactivity.

### Initializing Alpine on htmx-loaded Content

When htmx swaps new content into the DOM, Alpine components need to be initialized:

```typescript
// e.g. src/assets/scripts/index.ts
import htmx from 'htmx.org'
import Alpine from 'alpinejs'

// Re-initialize Alpine after htmx swaps
htmx.onLoad(content => {
	Alpine.initTree(content)
})

window.Alpine = Alpine
window.htmx = htmx
Alpine.start()
```

### Example: Dynamic Form with Validation

```html
<form
	x-data="{ submitting: false, errors: {} }"
	hx-post="/api/register"
	hx-target="#form-result"
	hx-indicator=".spinner"
	@htmx:before-request="submitting = true"
	@htmx:after-request="submitting = false">
	<input
		type="email"
		name="email"
		:class="{ 'error': errors.email }"
		@input="errors.email = null" />
	<span x-show="errors.email" x-text="errors.email" class="error-message"></span>

	<button type="submit" :disabled="submitting">
		<span x-show="!submitting">Register</span>
		<span x-show="submitting" class="spinner">Loading...</span>
	</button>
</form>
<div id="form-result"></div>
```

### Example: Live Search with Loading State

```html
<div x-data="{ loading: false, query: '' }">
	<input
		type="search"
		x-model="query"
		hx-get="/api/search"
		hx-trigger="keyup changed delay:300ms"
		hx-target="#results"
		hx-indicator="#search-loading"
		@htmx:before-request="loading = true"
		@htmx:after-request="loading = false"
		name="q"
		placeholder="Search..." />

	<div id="search-loading" x-show="loading" class="htmx-indicator">Searching...</div>

	<div id="results"></div>
</div>
```
