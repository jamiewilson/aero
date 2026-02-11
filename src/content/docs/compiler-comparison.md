# Template Compiler Comparison: TBD vs Hyperspace vs Nue

This document compares the compilation and rendering strategies of three HTML-first template engines.

## Overview

| Aspect | TBD | Hyperspace (Hypermore) | Nue |
|--------|-----|------------------------|-----|
| **Output** | Async function returning template literal | Imperative JS code appending to string | AST (JS object) |
| **Execution** | Function evaluation | `new Function(code)()` | Runtime AST traversal |
| **Conditionals** | Ternary inside template literal | Actual `if/else` statements | AST node with `{ some: [...] }` |
| **Escaping Complexity** | High (nested backticks) | Low (isolated scopes) | None (data structure) |

---

## TBD - Template Literal Return

### Architecture

```
HTML Template → Parser → Codegen → Async Function → Template Literal String
```

### Compilation Strategy

TBD compiles templates into an async function that returns a single template literal:

```javascript
export default async function(tbd) {
  const { site, slots = {} } = tbd;
  // build script code here
  return `<div>${ condition ? `<span>Yes</span>` : '' }</div>`;
}
```

### Conditional Handling

Conditionals are emitted as ternary expressions inside the template literal:

```javascript
// if="showTitle"
${ showTitle ? `<h1>Title</h1>` : '' }
```

### Strengths

- Simple mental model - one function, one return
- Straightforward interpolation with `${ }` syntax
- Clean async/await support for component rendering

### Weaknesses

- **Nested backtick escaping** - When conditionals nest (if inside if, or loops containing conditionals), the backticks from inner constructs aren't escaped relative to outer ones
- **Difficult to extend** - Adding if/else-if/else requires nested ternaries which compounds escaping issues
- **Debug complexity** - Generated code with nested template literals is hard to read

---

## Hyperspace (Hypermore) - Imperative Code Generation

### Architecture

```
HTML Template → Parser → Code Builder → Imperative JS String → new Function() → Execute
```

### Compilation Strategy

Hyperspace builds up imperative JavaScript code as a string, using a mutable output variable:

```javascript
let __EXPORT = "";

// Each piece of content appends to __EXPORT
__EXPORT += `<div>`;

// Conditionals are actual if/else statements
if (condition1) {
  __EXPORT += `<span>Branch 1</span>`;
} else if (condition2) {
  __EXPORT += `<span>Branch 2</span>`;
} else {
  __EXPORT += `<span>Fallback</span>`;
}

__EXPORT += `</div>`;
return __EXPORT;
```

### Conditional Handling (from tag-if.ts)

```javascript
// Wrap each branch body in a function
const __S0 = () => { __EXPORT += `body1`; }
const __S1 = () => { __EXPORT += `body2`; }
const __S2 = () => { __EXPORT += `body3`; }

// Emit actual control flow
if (__C0) {
  __S0();
} else if (__C1) {
  __S1();
} else {
  __S2();
}
```

### Strengths

- **No escaping issues** - Each template literal is isolated in its own scope
- **Extensible** - Easy to add new control flow (switch, try/catch, etc.)
- **Debuggable** - Generated code reads like normal JavaScript
- **Portals** - Can reorder output (fragments rendered into named portals)

### Weaknesses

- More complex code generation logic
- Larger generated code size
- Runtime function compilation overhead

---

## Nue - AST with Runtime Traversal

### Architecture

```
HTML Template → Tokenizer → AST Builder → JS Object → Runtime Renderer → DOM Nodes
```

### Compilation Strategy

Nue compiles templates into an Abstract Syntax Tree (AST) - a JavaScript object that describes the structure:

```javascript
{
  tag: 'div',
  children: [
    { tag: 'h1', children: [{ text: 'Hello' }] },
    { 
      some: [  // Conditional branches grouped together
        { tag: 'span', if: '_.count > 0', children: [...] },
        { tag: 'span', 'else-if': '_.count < 0', children: [...] },
        { tag: 'span', else: true, children: [...] }
      ]
    }
  ]
}
```

### Conditional Handling (from ast.js)

The `mergeConditionals` function groups sibling elements with `if/else-if/else` into a single `{ some: [...] }` node:

```javascript
function mergeConditionals(arr) {
  return arr.reduce((result, current) => {
    const is_if = current.if || current['else-if'] || current.else
    const last = result[result.length - 1]

    if (is_if) {
      if (current.if) result.push({ some: [current] })
      else if (last?.some) last.some.push(current)
      else result.push({ some: [current] })
    } else {
      result.push(current)
    }
    return result
  }, [])
}
```

At runtime, `renderIf` finds the first matching branch:

```javascript
function renderIf(ast, self) {
  const child = ast.some.find(el => {
    const fn = el.if || el['else-if']
    if (fn) return exec(fn, self)
    if (el.else) return true
  })
  return child ? render(child, self) : createFragment()
}
```

### Strengths

- **Clean separation** - Parsing produces data, runtime interprets it
- **No escaping issues** - No code generation, just data structures
- **Inspectable** - AST can be logged, validated, transformed
- **Reactive-ready** - AST can be re-rendered with new data efficiently
- **DOM diffing** - Built-in support for efficient updates

### Weaknesses

- Runtime interpretation overhead (vs pre-compiled code)
- Two-phase complexity (compile-time AST + runtime renderer)
- Expression evaluation via `new Function()` at runtime

---

## Conditional Comparison

### Example Template

```html
<div>
  <span :if="count > 0">Positive</span>
  <span :else-if="count < 0">Negative</span>
  <span :else>Zero</span>
</div>
```

### TBD Output (current approach - problematic)

```javascript
return `<div>${ count > 0 ? `<span>Positive</span>` 
  : count < 0 ? `<span>Negative</span>` 
  : `<span>Zero</span>` }</div>`;
```

**Problem**: Nested backticks break when bodies contain `${...}` expressions.

### Hyperspace Output

```javascript
let __EXPORT = "";
__EXPORT += `<div>`;
if (count > 0) {
  __EXPORT += `<span>Positive</span>`;
} else if (count < 0) {
  __EXPORT += `<span>Negative</span>`;
} else {
  __EXPORT += `<span>Zero</span>`;
}
__EXPORT += `</div>`;
return __EXPORT;
```

### Nue AST

```javascript
{
  tag: 'div',
  children: [{
    some: [
      { tag: 'span', if: '_.count > 0', children: [{ text: 'Positive' }] },
      { tag: 'span', 'else-if': '_.count < 0', children: [{ text: 'Negative' }] },
      { tag: 'span', else: true, children: [{ text: 'Zero' }] }
    ]
  }]
}
```

---

## Recommendations for TBD

### Option A: IIFE Approach (Minimal Change)

Keep current architecture but emit IIFEs for chains:

```javascript
return `<div>${(async () => {
  if (count > 0) return `<span>Positive</span>`;
  if (count < 0) return `<span>Negative</span>`;
  return `<span>Zero</span>`;
})()}</div>`;
```

**Pros**: Smallest change, each body isolated  
**Cons**: Still template-literal-based, verbose output

### Option B: Hyperspace-style Refactor (Medium Change)

Switch to mutable output variable:

```javascript
export default async function(tbd) {
  let __out = '';
  __out += `<div>`;
  if (count > 0) __out += `<span>Positive</span>`;
  else if (count < 0) __out += `<span>Negative</span>`;
  else __out += `<span>Zero</span>`;
  __out += `</div>`;
  return __out;
}
```

**Pros**: Eliminates escaping issues forever, extensible  
**Cons**: Larger refactor, changes fundamental output pattern

### Option C: Nue-style AST (Large Change)

Compile to AST, add runtime renderer:

```javascript
// Compile time
export const ast = { tag: 'div', children: [{ some: [...] }] };

// Runtime
export default async function(tbd) {
  return render(ast, tbd);
}
```

**Pros**: Most flexible, enables DOM diffing, reactive updates  
**Cons**: Largest rewrite, two-phase system

---

## Summary

| Approach | Escaping Safety | Change Size | Extensibility | Performance |
|----------|-----------------|-------------|---------------|-------------|
| **A: IIFE** | Good | Small | Medium | Good |
| **B: Hyperspace** | Excellent | Medium | Excellent | Good |
| **C: AST** | Excellent | Large | Excellent | Variable |

For the immediate if/else-if/else feature, **Option A (IIFE)** is recommended. For long-term maintainability, **Option B (Hyperspace-style)** provides the best balance of safety and simplicity.
