# Tsconfig path aliases

Path aliases (e.g. `@pages`, `@layouts`, `@components`) are **optional**. The framework injects defaults when your project has no `tsconfig.json` or when `compilerOptions.paths` does not define them.

The three aliases `@pages`, `@layouts`, and `@components` are available in every Aero project with no configuration: you can use them in imports and in the runtime even when there is no `tsconfig.json` or when `paths` is empty. The framework injects them from your `dirs` (e.g. `client/pages`, `client/layouts`, `client/components` by default).

## Defaults

When tsconfig is missing or omits the framework aliases, Aero injects:

- `@pages` → `<client>/pages` (relative to project root)
- `@layouts` → `<client>/layouts`
- `@components` → `<client>/components`

`<client>` is your client directory, by default `client`; it can be overridden via `dirs.client` in `aero.config.ts` or `vite.config.ts` (e.g. `aero({ dirs: { client: 'frontend' } })`).

So you can:

- Omit `tsconfig.json` and the build still works.
- Use a tsconfig with no `paths` (or empty `paths`) and the build still works.
- Remove all path aliases from tsconfig and rely on injected defaults.

## Overriding defaults

Any path you define in `tsconfig.json` under `compilerOptions.paths` **overrides** the framework default for that key. For example, if you set:

```json
{
	"compilerOptions": {
		"paths": {
			"@pages/*": ["./src/views/*"]
		}
	}
}
```

then `@pages` resolves to `src/views`; `@layouts` and `@components` still use the injected defaults (unless you add them to `paths` as well).

## Custom dirs

If you change `dirs.client` (or other dirs) in config, the injected defaults use those dirs. Keep your `tsconfig.json` `paths` in sync so that editor/IDE and the build agree. For example, if `dirs.client` is `frontend`, then `@pages` should point to `frontend/pages` in tsconfig.

When you use custom dirs and a tsconfig is present, the dev server prints a one-time warning reminding you to keep tsconfig paths in sync. It does not modify your tsconfig.

## Summary

- **No tsconfig or no paths**: Framework injects `@pages`, `@layouts`, `@components` from `dirs`.
- **Tsconfig with paths**: Your paths override the same keys; other keys get defaults.
- **Custom dirs**: Update tsconfig `paths` to match (e.g. `@pages` → `"<client>/pages"`); you’ll get a reminder if they may be out of sync.
