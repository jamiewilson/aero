# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Common Changelog](https://common-changelog.org/).

## [0.1.0]

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

[0.1.0]: https://github.com/jamiewilson/aero/releases/tag/v0.1.0
