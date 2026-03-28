# Interpolation and props (script/style)

## Text and attribute interpolation

- **Single braces:** `{ expression }` is one interpolation; the expression is evaluated at render time and the result is used (stringified in text, or as the value in attributes).
- **In attribute values only:** `{{` and `}}` are escapes that produce a literal `{` or `}` character. So you can output a literal brace inside an attribute.

## Auto-escaping

Text interpolations are automatically HTML-escaped to prevent XSS attacks:

```html
<script is:build>
  const name = '<script>alert("xss")</script>';
</script>
<p>Hello { name }</p>
```

Output: `<p>Hello &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>`

### Raw output

Use `raw()` to bypass escaping when you need to output raw HTML:

```html
<script is:build>
  const html = '<strong>bold</strong>';
</script>
<p>{ raw(html) }</p>
```

Output: `<p><strong>bold</strong></p>`

## Loop metadata

When using `data-each` with an index variable, you get access to loop metadata:

```html
<script is:build>
  const items = ['a', 'b', 'c'];
</script>
<ul>
  <li data-each="{ item, index in items }">
    { item } (index: { index }, first: { first }, last: { last }, length: { length })
  </li>
</ul>
```

Available variables:
- `item` - current item
- `index` - current index (0-based)
- `first` - true if first iteration
- `last` - true if last iteration
- `length` - total number of items

You can also use `data-each="{ item in items }"` without the index if you don't need metadata.

## props (script and style)

The `props` attribute on `<script>` and `<style>` uses the **same idea**: one braced expression, evaluated at render time. The value must be braced (`{ ... }`) and is used **as-is** (no extra "strip one level" rule). The expression must evaluate to an object; in script its keys become globals, in style they become CSS custom properties (e.g. `--fg`, `--bg`). Bare `props` (no value) spreads a local `props` variable.

| What you want                               | props value                 | Result                                      |
| ------------------------------------------- | --------------------------- | ------------------------------------------- |
| One variable as one key                     | `props="{ theme }"`         | One key `"theme"` (e.g. `--theme` in style) |
| Object's properties as keys (e.g. CSS vars) | `props="{ ...theme }"`      | Keys of `theme` → `--fg`, `--bg`, etc.      |
| Multiple variables                          | `props="{ title, accent }"` | Keys `title`, `accent`                      |

So to use an object's properties as CSS variables, use **spread**: `props="{ ...theme }"`. Using `props="{ theme }"` passes the whole object as a single key, not its properties.
