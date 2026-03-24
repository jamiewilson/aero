# @aero-js/diagnostics

Structured `AeroDiagnostic` types, terminal/browser formatters, PostCSS/CSS error bridging, Effect Cause mapping, and dev SSR error transport (`x-aero-diagnostics`).

- **Main export** — full API (includes `effect` and Node `fs` for source frames).
- **`@aero-js/diagnostics/browser`** — browser-only surface (no Effect) for the core client runtime.

`@aero-js/core` depends on this package and re-exports it as `@aero-js/core/diagnostics` for backward compatibility.
