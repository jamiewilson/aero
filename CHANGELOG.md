# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Common Changelog](https://common-changelog.org/).

## [Unreleased]

### Added

- **Redirects:** `redirects` option in `aero.config.ts` or `aero({ redirects: [{ from, to, status? }] })`. Applied in dev and passed to Nitro for production; use `@aerobuilt/config`’s `redirectsToRouteRules()` in `nitro.config.ts` to emit route rules.
- **Request-time middleware:** Optional `middleware` in `aero.config.ts` or `aero({ middleware: [...] })` runs at request time (dev) for redirects, rewrites, or custom responses.
- **create-aero refactor:** Project initializer moved into `packages/create-aero` with CLI; minimal template in `packages/templates/minimal`, kitchen-sink example in `examples/kitchen-sink`. Scaffold with `pnpm run create-aero <name>` from `packages/create-aero` or `pnpm create aero <dir>` when published.
- **pnpm workspace:** Monorepo uses pnpm workspaces; root `dev`/`build` run kitchen-sink example; `packages/create-aero` scaffolds into `packages/create-aero/dist/<name>` (gitignored).
- Add `site` option for canonical site URL: set in `aero.config.ts` or `aero({ site: 'https://example.com' })`. Exposed as `import.meta.env.SITE` and `Aero.site` in templates for sitemap, RSS, and canonical links.
- Add automatic **sitemap.xml** generation when `site` is set: written to `dist/sitemap.xml` after the static build, listing all pre-rendered routes as absolute URLs (404 excluded).
- Document **environment variable** convention: Vite’s `import.meta.env`, `VITE_` prefix for client-exposed vars, `.env` loading, and optional `env.d.ts` for TypeScript. Add example `env.d.ts` in the start package.
- Add TSDocs to core and packages ([`87f3486`](https://github.com/jamiewilson/aero/commit/87f3486))
- Add documentation for VS Code extension ([`bbed627`](https://github.com/jamiewilson/aero/commit/bbed627))
- Add documentation updates across repo ([`54389c1`](https://github.com/jamiewilson/aero/commit/54389c1))
- Add docs for content package tests ([`80ba0fc`](https://github.com/jamiewilson/aero/commit/80ba0fc))
- Add expanded Vite plugin test coverage ([`a6c6188`](https://github.com/jamiewilson/aero/commit/a6c6188))

### Changed

- Add IR layer for codegen (DOM → IR → JS) ([`b0f18d8`](https://github.com/jamiewilson/aero/commit/b0f18d8))
- Split Vite plugin into focused sub-plugins ([`51081b3`](https://github.com/jamiewilson/aero/commit/51081b3))
- Use single `emitRenderFunction` for render emission ([`cf7554d`](https://github.com/jamiewilson/aero/commit/cf7554d))
- Centralize page resolution and key derivation in routing ([`ef0ee6c`](https://github.com/jamiewilson/aero/commit/ef0ee6c))
- Unify script type and client URL handling ([`0fd41e9`](https://github.com/jamiewilson/aero/commit/0fd41e9))
- Improve HMR state, runtime slots/404/instance, parser SVG and Math handling ([`2bae20f`](https://github.com/jamiewilson/aero/commit/2bae20f))
- Update agent and rule docs ([`7f426b2`](https://github.com/jamiewilson/aero/commit/7f426b2))
- Address TODOs and FIXMEs across core, content, and VS Code ([`0b70e15`](https://github.com/jamiewilson/aero/commit/0b70e15))
- Remove unneeded warnings from VS Code diagnostics ([`afb1198`](https://github.com/jamiewilson/aero/commit/afb1198))
- Clean up and polish script handling ([`7ee023a`](https://github.com/jamiewilson/aero/commit/7ee023a))

### Fixed

- Fix logic for checking head scripts ([`4877635`](https://github.com/jamiewilson/aero/commit/4877635))
- Fix `pass:data` for bundled client scripts and parser index-based edits ([`4e55c32`](https://github.com/jamiewilson/aero/commit/4e55c32))
- Fix build for new script syntax/taxonomy ([`a768756`](https://github.com/jamiewilson/aero/commit/a768756))
- Fix handling of scripts in `<head>` ([`2d9315b`](https://github.com/jamiewilson/aero/commit/2d9315b))
- Fix VS Code diagnostic bugs for updated script types ([`7f950e2`](https://github.com/jamiewilson/aero/commit/7f950e2))
- Fix diagnostics for all new script types and scopes (including `pass:data`) ([`79c1e9b`](https://github.com/jamiewilson/aero/commit/79c1e9b))

### Added

- Add `pass:data` directive for threading build-time data to client runtime and CSS ([`955652b`](https://github.com/jamiewilson/aero/commit/955652b), [`d0fdada`](https://github.com/jamiewilson/aero/commit/d0fdaed))
- Add `is:bundled` script type supporting Vite module processing with HMR ([`3ae30cf`](https://github.com/jamiewilson/aero/commit/3ae30cf))
- Add `is:inline` script type for raw unprocessed client scripts ([`3ae30cf`](https://github.com/jamiewilson/aero/commit/3ae30cf))
- Add `is:build` script type for build-time server execution ([`3ae30cf`](https://github.com/jamiewilson/aero/commit/3ae30cf))
- Add style data injection via `pass:data` in `<style>` tags ([`d0fdaed`](https://github.com/jamiewilson/aero/commit/d0fdaed))
- Add content collections API with `getCollection()` and lazy `render()` ([`1027ccf`](https://github.com/jamiewilson/aero/commit/1027ccf), [`dab4332`](https://github.com/jamiewilson/aero/commit/dab4332))
- Add explicit content publishing requirement ([`c8d1301`](https://github.com/jamiewilson/aero/commit/c8d1301))
- Add `getStaticPaths` support for returning `{ params, props }` ([`1027ccf`](https://github.com/jamiewilson/aero/commit/1027ccf))
- Add VS Code extension features and diagnostics ([`6633563`](https://github.com/jamiewilson/aero/commit/6633563), [`db247ee`](https://github.com/jamiewilson/aero/commit/db247ee))
- Add better diagnostics for Alpine.js and HTML in templates ([`db247ee`](https://github.com/jamiewilson/aero/commit/db247ee))
- Add HTML minifier to build process ([`8c60ec4`](https://github.com/jamiewilson/aero/commit/8c60ec4))
- Add image optimization via `vite-plugin-image-optimizer` with sharp/svgo compression ([`40458a8`](https://github.com/jamiewilson/aero/commit/40458a8))

### Changed

- Migrate script taxonomy from `on:build`/`on:client` to `is:build`/`is:bundled`/`is:inline` ([`3ae30cf`](https://github.com/jamiewilson/aero/commit/3ae30cf))
- Remove `site` object from global scope ([`b7f9ba6`](https://github.com/jamiewilson/aero/commit/b7f9ba6))
- Change inline scripts to be placed at end of `<body>` for better loading order ([`e2fc147`](https://github.com/jamiewilson/aero/commit/e2fc147))
- Improve virtual module invalidation for HMR ([`b7a9e68`](https://github.com/jamiewilson/aero/commit/b7a9e68))
- Correct merging logic of user and default Vite configs ([`31c3395`](https://github.com/jamiewilson/aero/commit/31c3395))
- Refactor Vite config with improved defaults and minification ([`bdbee66`](https://github.com/jamiewilson/aero/commit/bdbee66))
- Extract config to separate package ([`07f2eac`](https://github.com/jamiewilson/aero/commit/07f2eac))
- Upgrade to Vite 8 and other dependency version bumps ([`140ff14`](https://github.com/jamiewilson/aero/commit/140ff14))
- Pull client scripts to end of document ([`6bef501`](https://github.com/jamiewilson/aero/commit/6bef501))
- Pull root-level styles into `<head>` ([`7a4347a`](https://github.com/jamiewilson/aero/commit/7a4347a))
- Flatten asset output in `dist/assets/` ([`bdbee66`](https://github.com/jamiewilson/aero/commit/bdbee66))
- Remove `props` from allowed globals ([`4f6af0f`](https://github.com/jamiewilson/aero/commit/4f6af0f))
- Improve test coverage ([`47c3929`](https://github.com/jamiewilson/aero/commit/47c3929))

### Fixed

- Handle `pass:data` for `is:bundled` scripts with proper server-to-client data proxying ([`c5eb77a`](https://github.com/jamiewilson/aero/commit/c5eb77a))
- Restore codegen with `pass:data` feature ([`0273397`](https://github.com/jamiewilson/aero/commit/0273397))
- Fix outdated test bugs ([`8b12347`](https://github.com/jamiewilson/aero/commit/8b12347))
- Fix incorrect flagging of variables ([`2e8d36d`](https://github.com/jamiewilson/aero/commit/2e8d36d))
- Handle redeclaring imports and consts ([`41565c4`](https://github.com/jamiewilson/aero/commit/41565c4))
- Fix VSCode diagnostic bugs ([`cb0f9cd`](https://github.com/jamiewilson/aero/commit/cb0f9cd))
