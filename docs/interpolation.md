# Interpolation and pass:data

## Text and attribute interpolation

- **Single braces:** `{ expression }` is one interpolation; the expression is evaluated at render time and the result is used (stringified in text, or as the value in attributes).
- **In attribute values only:** `{{` and `}}` are escapes that produce a literal `{` or `}` character. So you can output a literal brace inside an attribute.

## pass:data (script and style)

The `pass:data` attribute uses the **same idea**: one braced expression, evaluated at render time. The value must be braced (`{ ... }`) and is used **as-is** (no extra “strip one level” rule). The expression must evaluate to an object; in script its keys become globals, in style they become CSS custom properties (e.g. `--fg`, `--bg`).

| What you want | pass:data value | Result |
|---------------|-----------------|--------|
| One variable as one key | `pass:data="{ theme }"` | One key `"theme"` (e.g. `--theme` in style) |
| Object’s properties as keys (e.g. CSS vars) | `pass:data="{ ...theme }"` | Keys of `theme` → `--fg`, `--bg`, etc. |
| Multiple variables | `pass:data="{ title, accent }"` | Keys `title`, `accent` |

So to use an object’s properties as CSS variables, use **spread**: `pass:data="{ ...theme }"`. Using `pass:data="{ theme }"` passes the whole object as a single key, not its properties.
