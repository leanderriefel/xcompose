# Releasing XCompose

## Prepare both browsers

Use Node.js 24 and pnpm 10.15.1 (the version in package.json).

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install firefox chromium
pnpm release patch
```

`patch` increments both version files. You can also use `minor`, `major`, or an explicit higher version such as `0.3.0`. To retry or rebuild the current version, use `pnpm release` with no argument. A failed check stops packaging; fix it and retry without another version bump.

The command runs type checking, lint, formatting, regression tests, both production builds, Mozilla's extension validator, and ZIP verification. It writes Chrome, Firefox, and review-source archives plus SHA-256 checksums under `packages/`. No system ZIP utility or FFmpeg is required. Store artwork is unchanged by routine releases; regenerate it separately with `pnpm assets` when needed (requires FFmpeg and the artwork sources).

Update CHANGELOG.md before submitting a version. Load `dist/` unpacked in Chrome and `dist-firefox/manifest.json` through Firefox's `about:debugging` for a manual smoke test. Test Fix, Undo, multiline drafts, continued typing, and multiple composers. While generating, verify typing is blocked, Cancel restores editing immediately, and focusing the locked input does not cause the response to append. The client has a 60-second deadline even if the worker stops responding. Provider tests require your own key and explicit provider permission from Settings → Test.

## Submit to the stores

1. Open the [Chrome developer dashboard](https://chrome.google.com/webstore/devconsole/04f0ee1d-33be-419c-8617-cabba26ae9ee), select XCompose, upload `packages/xcompose-VERSION-chrome.zip`, and submit it for review with automatic publication after approval.
2. Open [Firefox New Version](https://addons.mozilla.org/en-US/developers/addon/xcompose/versions/submit/), upload `packages/xcompose-VERSION-firefox.zip`, and include `packages/xcompose-VERSION-source.zip` when asked for source code. Use the relevant CHANGELOG entry for release notes.
3. Verify each dashboard reports the new version as submitted, pending review, or published. Store review is independent of a GitHub release. Do not describe a pending version as live.

Browser sessions handle store authentication; this repository currently has no store API credentials. Chrome restricts scripting on its Web Store dashboard, so that upload may require a manual step. No credentials should be added to source archives or committed to Git. API automation can be configured separately using the [Chrome Web Store API](https://developer.chrome.com/docs/webstore/api) and [web-ext signing](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign).

## Publish the source release

After checking the diff and committing the release, push the commit and a matching `vVERSION` tag. The GitHub Actions release workflow repeats verification on Linux, attaches the three ZIPs and checksums to a GitHub release, and includes generated release notes. It does not submit to stores or claim store approval.

```sh
git push origin HEAD
git tag v0.2.1
git push origin v0.2.1
```

Substitute the version you prepared. The workflow also supports a manual run that produces downloadable artifacts without creating a release.

## Mozilla reviewer: reproduce the Firefox build

Extract the source archive into an empty directory. All build inputs, icons, dependency versions, and configuration are included.

```sh
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm build:firefox
```

The output is `dist-firefox/`. Build from these sources, not the Chrome ZIP. The source uses TypeScript, SolidJS, and Vite with CRXJS. No credentials, external service, generated artwork, or environment file is needed to build. Run `pnpm check` and `pnpm test` for the additional checks.

## Local composer playground

`pnpm test:browser` runs the production editor helper in temporary Firefox and Chromium extensions against real Draft.js page editors, checking both DOM text and React EditorState. These tests run in CI before packaging or publishing. They use isolated profiles and local test text; no login or API key is required. Install browser binaries once with `pnpm exec playwright install firefox chromium` (add `--with-deps` on Linux). To reproduce the Firefox 0.2.1 regression from a Git checkout, run `node scripts/test-browser.mjs --baseline`; this is expected to fail.

Run `pnpm test:manual` and open `http://127.0.0.1:5174/tests/composer.html`. This runs the real Draft.js library and production XCompose toolbar against local mock provider responses. It checks DOM text against EditorState after repeated replacements, undo, blank lines, and emoji. No API keys are needed. Also type after applying and undoing to check the composer remains editable.

The Firefox validator fails on errors and new warnings. Two reviewed dependency warnings are allowed: SolidJS uses innerHTML for its compiled static templates (no user content enters that factory), and Zod bundles a Function-constructor CSP probe. XCompose enables Zod jitless validation to avoid that probe at runtime. First-party toolbar icons use DOM construction.
