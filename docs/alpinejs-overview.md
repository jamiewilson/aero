## Alpine.js Overview

Alpine.js provides reactive and declarative behavior directly in your HTML markup.

### Setup

Import and initialize Alpine in your main entry file:

```typescript
// e.g. src/assets/scripts/index.ts
import 'htmx.org'
import Alpine from 'alpinejs'

// Make Alpine available globally
window.Alpine = Alpine

// Start Alpine
Alpine.start()
```

### Basic Usage

```html
<!-- Simple counter -->
<div x-data="{ count: 0 }">
	<button @click="count++">Increment</button>
	<span x-text="count"></span>
</div>

<!-- Toggle visibility -->
<div x-data="{ open: false }">
	<button @click="open = !open">Toggle</button>
	<div x-show="open" x-transition>Hidden content revealed!</div>
</div>

<!-- Two-way binding -->
<div x-data="{ name: '' }">
	<input type="text" x-model="name" placeholder="Your name" />
	<p>Hello, <span x-text="name || 'stranger'"></span>!</p>
</div>
```

### Core Alpine Directives

| Directive      | Description                                         |
| -------------- | --------------------------------------------------- |
| `x-data`       | Define a reactive data scope                        |
| `x-bind`       | Bind attributes reactively (shorthand: `:attr`)     |
| `x-on`         | Listen for events (shorthand: `@event`)             |
| `x-text`       | Set the text content                                |
| `x-html`       | Set the inner HTML                                  |
| `x-model`      | Two-way data binding for inputs                     |
| `x-show`       | Toggle visibility (uses CSS display)                |
| `x-if`         | Conditionally render element (destroys/creates DOM) |
| `x-for`        | Loop over items                                     |
| `x-transition` | Apply CSS transitions                               |
| `x-ref`        | Reference an element (access via `$refs`)           |
| `x-init`       | Run code when component initializes                 |

### Reusable Components with Alpine.data()

```typescript
// e.g. src/assets/scripts/index.ts
import Alpine from 'alpinejs'

// Register reusable components
Alpine.data('dropdown', () => ({
	open: false,
	toggle() {
		this.open = !this.open
	},
	close() {
		this.open = false
	},
}))

Alpine.data('counter', (initialCount = 0) => ({
	count: initialCount,
	increment() {
		this.count++
	},
	decrement() {
		this.count--
	},
}))

window.Alpine = Alpine
Alpine.start()
```

```html
<!-- Use registered components -->
<div x-data="dropdown">
	<button @click="toggle">Menu</button>
	<ul x-show="open" @click.outside="close">
		<li>Item 1</li>
		<li>Item 2</li>
	</ul>
</div>

<div x-data="counter(10)">
	<button @click="decrement">-</button>
	<span x-text="count"></span>
	<button @click="increment">+</button>
</div>
```

### Global State with Alpine.store()

```typescript
// e.g. src/assets/scripts/index.ts
import Alpine from 'alpinejs'

Alpine.store('user', {
	name: 'Guest',
	loggedIn: false,
	login(name) {
		this.name = name
		this.loggedIn = true
	},
	logout() {
		this.name = 'Guest'
		this.loggedIn = false
	},
})

window.Alpine = Alpine
Alpine.start()
```

```html
<!-- Access global store anywhere -->
<div x-data>
	<template x-if="$store.user.loggedIn">
		<p>Welcome, <span x-text="$store.user.name"></span>!</p>
	</template>
	<template x-if="!$store.user.loggedIn">
		<button @click="$store.user.login('John')">Login</button>
	</template>
</div>
```
