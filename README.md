# XCompose

> Minimal AI writing assistant that hooks right into the **X (Twitter) compose dialog**.

Fix grammar, shorten, make it punchier — without leaving the post box. Bring your own key: **OpenAI, Anthropic, OpenRouter, OpenCode / Zen, or any OpenAI-compatible endpoint**.

![license MIT](https://img.shields.io/badge/license-MIT-black)
![manifest v3](https://img.shields.io/badge/manifest-v3-1D9BF0)
![chrome & firefox](https://img.shields.io/badge/browser-Chrome%20%7C%20Firefox-black)
![typescript](https://img.shields.io/badge/TypeScript-5.9-black?logo=typescript)
![oxlint](https://img.shields.io/badge/lint-oxlint-1D9BF0) ![oxfmt](https://img.shields.io/badge/format-oxfmt-black) ![pnpm](https://img.shields.io/badge/pnpm-10.15-F69220)

---

### ✨ What it does

- Injects a tiny, monochrome toolbar **directly under X's compose textbox** (timeline composer + modal dialog both supported).
- Three primary actions — **✦ Fix**, **◐ Shorten**, **⚡ Punchier** — plus a `▾` overflow for **Expand / Formal / Casual / Emojify**.
- Replaces the draft **in place** with optimistic undo (`↩`) and toast feedback.
- Shortcut: <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>G</kbd> to fix grammar.
- No remote storage, no proxy, no tracking. Your key stays in `chrome.storage.local`.

### 🎨 Design

Intentionally **very very simple**:

- **Popup** (clicking the extension icon) is just status + `Open settings`. No clutter.
- Full settings live in the **Options page** (opens in a tab).
- Colors are **X-native**: pure black `#000`, border `#2F3336`, text `#E7E9EA`, muted `#71767B`, accent **Twitter blue** `#1D9BF0`. High contrast, monochrome, a little brutalist.

```
popup:  [● XCompose v0.1.0 ⚙]          content bar in compose:
        [● Ready  OPENAI pill]         [● XCompose | ✦ Fix | ◐ Shorten | ⚡ Punchier | ▾ | ↩ ]
        [Model: gpt-4o-mini]           subtle rounded card, 1px border, blue primary
        [Open settings] [How it works]
```

### 🔌 Providers

| Provider | Base URL | Model default | Notes |
|---|---|---|---|
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o-mini` | `sk-…` |
| **Anthropic** | `https://api.anthropic.com/v1` | `claude-3-5-haiku-latest` | `sk-ant-…` |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` | One key → 300+ models |
| **OpenCode / Zen** | `https://api.opencode.ai/v1` | `gpt-4o-mini` | Paste your Zen key. Self-host? Override Base URL |
| **Custom** | _(you set)_ | `gpt-4o-mini` | Any OpenAI-compatible: LiteLLM, vLLM, Ollama proxy, etc. |

> **ChatGPT Plus account?** XCompose is BYOK (API key). To spend your Plus quota, put an OpenAI-compatible proxy in front of it (e.g. OpenRouter) and point XCompose at it via **Custom** provider. OpenCode Zen works the same way.

### 🚀 Install (dev)

This project is **TypeScript + Vite + @crxjs/vite-plugin** with **pnpm** (`packageManager: pnpm@10.15.1`). You build once, then load `dist/` as an unpacked extension (with HMR if you run `pnpm dev`).

```bash
# 1. clone + install (requires pnpm 10+; corepack enable pnpm)
pnpm install

# 2. typecheck + build
pnpm run build        # → dist/  (Chrome)
pnpm run build:firefox # → dist-firefox/ (Firefox)
# or keep HMR during dev:
pnpm run dev          # vite dev server with crx HMR
```

#### Chrome / Edge / Brave (Chromium)

1. Go to `chrome://extensions` → toggle **Developer mode** (top-right).
2. **Load unpacked** → select the `dist/` folder (not the repo root).
3. Pin XCompose. Go to `x.com`, hit **Post**, see the bar under the textbox.
4. Click the extension icon → **Open settings** → paste your key → **Test connection**.

#### Firefox

1. `pnpm run build:firefox` (or `pnpm run build` — same MV3 works on FF 109+)
2. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…**
3. Select `dist-firefox/manifest.json` (or `dist/manifest.json`).
4. For a signed build (AMO): `pnpm run zip:firefox`

> The source `manifest.json` is MV3 with `browser_specific_settings.gecko` — Vite+CRX rewrites `background.service_worker` + `content_scripts` + `web_accessible_resources` for the target. No manual manifest editing.

### ⚙️ Settings

Open via extension popup → **Open settings** or `chrome://extensions` → Details → Extension options.

- **Provider / Model / API key / Base URL** — `Test connection` sends a tiny probe (`"hello wrld"` → expect corrected).
- **Prompts** — every action is just a system prompt. Edit per-action, restore defaults individually. Auto-saves.
- **Export / Import** — JSON backup (optionally include key). Useful for syncing devices.
- **No analytics**. No `host_permissions` beyond `x.com`/`twitter.com` + your LLM provider + `*://*/*` for Custom. Remove `*://*/*` in `manifest.json` if you only use OpenAI/Anthropic.

### 🧩 How it hooks into X

- `MutationObserver` on `document.body` watches for SPA navigation + dialog mounts.
- Selectors target X's Lexical editor: `div[data-lexical-editor="true"]`, `div[data-testid="tweetTextarea_0"]`, `div[role="textbox"][contenteditable]`.
- The bar is injected **once per editor** (`WeakSet` + `dataset` flag), anchored right before X's bottom toolbar (`[data-testid="toolBar"]` / `[data-testid="tweetButton"]`) or directly after the textbox as fallback.
- `getEditorText` uses `innerText`; `setEditorText` focuses, selects all, tries `document.execCommand('insertText')` (most reliable for Lexical) then falls back to `beforeinput`/`paste` events and direct DOM manipulation, finally dispatching `input`/`change` so X's React state sees the change.
- Undo stashes `bar.dataset.prevText`.

### 🗂 Structure

```
xcompose/
├── manifest.json          # MV3, host_permissions, gecko id (source, rewritten by Vite)
├── vite.config.ts         # Vite + @crxjs/vite-plugin (HMR, bundling, Firefox target)
├── tsconfig.json          # strict TS 5.9
├── .oxlintrc.json         # oxlint (ultra-fast, type-aware)
├── .oxfmtrc.json          # oxfmt
├── pnpm-lock.yaml         # pnpm 10 lockfile
├── icons/                 # 16/32/48/128 PNG (Pillow-generated)
├── src/
│   ├── content.ts / .css  # toolbar injection + Lexical bridge
│   ├── background.ts      # LLM proxy (keeps key out of page ctx, handles CORS)
│   ├── lib/
│   │   ├── types.ts       # ProviderId, XComposeConfig, ActionMeta
│   │   ├── storage.ts     # chrome.storage wrapper + defaults (typed)
│   │   ├── prompts.ts     # action catalog
│   │   └── providers.ts   # openai-compatible + anthropic fetch
│   ├── popup.html/ts/css  # minimal 340px card
│   └── options.html/ts/css# full settings
├── scripts/
│   ├── gen_icons.py       # regenerate icons
│   └── zip.mjs            # build zip for store submission
├── LICENSE, README, package.json
```

**No build step was required in v0.0 — now it's Vite+TS for DX, but the output in `dist/` is still a plain unpacked extension (vanilla JS+CSS, no runtime).**

### 🔒 Privacy

- Keys and prompts stored in `chrome.storage.local` only.
- Network requests go **directly** from the background service worker to your selected provider. No intermediate server, no logging.
- View source: `src/lib/providers.ts:11` and `src/background.ts:1`.

### 🛠 Tooling (modern)

This repo embraces modern, fast tooling as requested:

| Tool | Why |
|---|---|
| **TypeScript 5.9** (`strict`) | Full types for `chrome.*`, providers, prompts — catches API drift |
| **oxlint** (`type-aware`) | ~50-100× faster than ESLint, same rules via `typescript`/`unicorn`/`import` plugins |
| **oxfmt** | Consistent formatting (100 cols, 2 spaces) — faster than Prettier |
| **Vite 6 + @crxjs/vite-plugin 2** | Instant dev/HMR for extensions, proper `manifest.json` rewriting, Chrome+Firefox from one source |
| **pnpm 10** | Fast, strict, content-addressable store; `pnpm-lock.yaml` + `packageManager` field |

```bash
pnpm run typecheck   # tsc --noEmit
pnpm run lint        # oxlint src --type-aware
pnpm run lint:fix    # oxlint src --fix --type-aware
pnpm run format      # oxfmt --check src
pnpm run format:fix  # oxfmt src
pnpm run check       # typecheck + lint + format (CI)
pnpm run dev         # vite dev server + HMR
pnpm run build       # typecheck + vite build → dist/
pnpm run build:firefox
```

CI-friendly: `pnpm run check` fails on type, lint, or format drift.

Config files: `tsconfig.json:1`, `.oxlintrc.json:1`, `.oxfmtrc.json:1`, `vite.config.ts:1`.

### 🛠 Build a release zip

```bash
pnpm run build          # → dist/
pnpm run zip            # → xcompose-0.1.0-chrome.zip
pnpm run build:firefox  # → dist-firefox/
pnpm run zip:firefox    # → xcompose-0.1.0-firefox.zip
```

Or manually: `zip -r xcompose.zip dist -x "*.DS_Store"` 

### 🤝 Contributing

PRs welcome. Keep the core bar minimal — settings can be rich.

```bash
git clone https://github.com/<you>/xcompose
cd xcompose
pnpm install
pnpm run dev          # or pnpm run build and load dist/
# hack on src/*.ts — TS will complain loudly if you break types
pnpm run check        # before pushing
python scripts/gen_icons.py  # if you tweak icons (needs Pillow)
```

Please run a quick manual test on both `x.com` main composer and the modal dialog (`Post` → dialog) and on both Chrome and Firefox before submitting.

### 📄 License

MIT — see [LICENSE](LICENSE).

---

Built for the chronically online who want their drafts to sound like they proofread them. ✦
