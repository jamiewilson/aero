# Why Not Web Components?

Since Aero strives to stay as close to the web platform as possible, a common question is: **Why not just use Web Components?**

Aero and Web Components share the same admiration for standard web technologies, but they optimize for completely different developer experiences and use cases. This document outlines what Aero provides out of the box, the general consensus on the shortcomings of Web Components for building full applications, and when you _should_ choose Web Components instead.

## What Aero Enables (The Ergonomics)

Aero is designed for **HTML-first authoring** and **static-first delivery**. It provides the ergonomics of a modern template engine but compiles away to pure HTML.

- **Authoring in HTML, not JS:** In Aero, your components are just `.html` files. You don't need to write `class MyElement extends HTMLElement`, manually attach shadow roots, or imperatively update the DOM.
- **No Client-Side JavaScript Required:** Aero compiles your templating (like `{ site.title }`, `if`/`else`, and `each` loops) at build time. The user receives plain, static HTML. Web components, by default, require JavaScript to be parsed and executed before they render anything, leading to performance overhead and potential Flash of Unstyled Content (FOUC).
- **Global Styling is Trivial:** Because Aero components render into the standard Document Object Model ("Light DOM"), your global CSS, Tailwind classes, or foundational stylesheets apply naturally.
- **Clear Build vs. Client Split:** Aero gives you `<script is:build>` for build-time logic (fetching data, reading files) and plain `<script>` for client-side interactivity.
- **HTML Over the Wire:** Aero pairs perfectly with libraries like Alpine.js and HTMX because it outputs standard DOM elements that these libraries can easily target and mutate.

## Web Components: General Consensus and Shortcomings

While Web Components offer powerful encapsulation, they are often considered a "low-level browser primitive" rather than a complete application framework. When building standard websites, developers frequently run into these pain points:

### 1. You Have to Author in JavaScript

To create a Web Component, you are forced to write JavaScript. You must construct a class, define lifecycle methods (`connectedCallback`), and manually manage the DOM inside it. This takes you away from the declarative nature of HTML and makes simple templating surprisingly verbose unless you bring in a utility library like Lit.

### 2. The Shadow DOM makes Styling Difficult

The Shadow DOM is fantastic for strict encapsulation, but it's a double-edged sword.

- Global styles don't easily penetrate a Web Component's shadow root.
- If you want a Web Component to adapt to a site's global typography or design system, you have to meticulously expose CSS Custom Variables (`var(--theme-color)`) or `::part()` pseudo-elements.
- Resetting styles or sharing basic utility classes across standard DOM and Shadow DOM components is notoriously frustrating.

### 3. Server-Side Rendering (SSR) is Complex

Standard Web Components require a browser environment to run `customElements.define()`. To server-side render them, you need complex polyfills or "Declarative Shadow DOM" (DSD). Even with DSD, the developer ergonomics are still catching up to the seamless SSR/SSG provided by tools like Aero, Astro, or Next.js.

### 4. Poor Form Integration

Historically, custom form controls inside Web Components have struggled to participate in standard `<form>` submissions because their internal `<input>` elements are hidden inside the Shadow DOM. While the `ElementInternals` API solves this now, it requires writing significant boilerplate JavaScript just to make a custom element behave like a standard `<input>`.

### 5. Managing State and Reactivity

Web Components do not provide state management or declarative reactivity out of the box. If an attribute changes, you have to manually watch it using `observedAttributes` and write imperative JavaScript to update the DOM.

## When You _Should_ Use Web Components Instead of Aero

Web Components are an incredible tool when used for what they were strictly designed for: **portable, heavily encapsulated reusable widgets.**

You should choose Web Components over Aero if:

1. **You are building an agnostic Design System:** If your company has teams using React, Vue, Angular, and vanilla JS, and you need to build a single UI library (like buttons, modals, or date pickers) that works consistently across all of them without build-step conflicts.
2. **You want strict style isolation:** If you are building a widget that will be embedded on third-party websites (like a customer support chat bubble or a Stripe checkout button), the Shadow DOM ensures the host site's CSS cannot break your component.
3. **You are doing heavy client-side rendering:** For highly interactive, app-like client-side components where static HTML generation isn't the priority, Web Components (especially paired with a library like Lit) excel.
4. **You intend to publish UI primitives:** If your goal is to publish a component to npm that _anyone_ can drop into an `.html` file with a single `<script>` tag and no compilation step.

**In summary:** Aero is optimized for building the _website itself_, prioritizing fast, static HTML and excellent developer ergonomics. Web Components are low-level primitives optimized for building highly encapsulated _widgets_ that can run anywhere.
