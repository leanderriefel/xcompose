# XCompose

Fix typos, shorten a draft, or make a post a little punchier, right where you write on X.

**[Get it for Chrome](https://chromewebstore.google.com/detail/xcompose/gmkogaffieecihojdkblmoheokdehclo)** · **[Get it for Firefox](https://addons.mozilla.org/en-US/firefox/addon/xcompose/)**

Bring your own **OpenRouter** or **OpenCode Go** API key.

## Get started

1. Install XCompose, open its **Settings**, and choose your provider.
2. Add your API key, click **Test**, and allow access to your provider when prompted.
3. Write a post or reply on X, then open the **XCompose** menu beside the compose tools.

Choose **Fix**, **Shorten**, or **Punchier** to rewrite your draft in place. **Undo** brings back your previous draft. You decide when to post.

Want a different tone? Enable more actions in Settings, or adjust the model and instructions to suit your writing.

**Shortcut:** `Ctrl+Shift+G` on Windows/Linux or `⌘+Shift+G` on Mac fixes grammar in the active draft.

## Your words, your provider

Your settings and API keys are stored in your browser. When you use an action, your draft and instructions go directly to your chosen AI provider, with your key used to authenticate the request. XCompose has no analytics or developer-run server.

[Privacy policy](PRIVACY.md) · [Report an issue or suggest an idea](https://github.com/leanderriefel/xcompose/issues)

## For developers

Use Node.js 24 and pnpm 10.15.1.

```sh
pnpm install --frozen-lockfile
pnpm dev            # local development
pnpm build          # Chrome extension in dist/
pnpm build:firefox  # Firefox extension in dist-firefox/
pnpm check          # types, lint, and formatting
pnpm test           # regression tests
```

Load `dist/` as an unpacked extension in Chrome, or load `dist-firefox/manifest.json` through Firefox's `about:debugging`.

[Release guide](RELEASING.md) · [Changelog](CHANGELOG.md) · [Downloads](https://github.com/leanderriefel/xcompose/releases) · [MIT license](LICENSE)
