# XCompose

> AI buttons inside the **X (Twitter) compose box**. Fix grammar, shorten, punchier — bring your own key.

![license MIT](https://img.shields.io/badge/license-MIT-black)
![manifest v3](https://img.shields.io/badge/manifest-v3-1D9BF0)
![pnpm](https://img.shields.io/badge/pnpm-10-F69220)
![typescript](https://img.shields.io/badge/TypeScript-7-black?logo=typescript)
![solid](https://img.shields.io/badge/SolidJS-1.9-2c4f7c?logo=solid)

## What it does

- Injects a small monochrome bar **under X's compose textbox** (timeline composer + modal dialog).
- Buttons: **Fix · Shorten · Punchier** by default, more in `▾` (Expand, Formal, Casual, Emojify). Which buttons show is configurable.
- Replaces the draft in place. `↩` undoes. `Ctrl/⌘+Shift+G` fixes grammar.
- Models, prompts, and toolbar buttons are all configurable in settings.
- No backend, no analytics. Keys stay in `chrome.storage.local`.

## Providers

| Provider | Default model | Notes |
|---|---|---|
| OpenAI | `gpt-5.6-luna` | ChatGPT users: this needs an *API key*, not Plus |
| Anthropic | `claude-haiku-4-5` | |
| OpenRouter | `openai/gpt-5.6-luna` | One key → any model |
| OpenCode | `gpt-5.6-luna` | Zen key; override Base URL if self-hosted |
| Custom | — | Any OpenAI-compatible endpoint |

## Develop

```bash
pnpm install
pnpm dev            # vite dev server + HMR
pnpm build          # → dist/        (Chrome: load unpacked)
pnpm build:firefox  # → dist-firefox (about:debugging, inline sourcemap for AMO)
pnpm check          # typecheck + lint + format
pnpm zip            # store zip (after build)
```

| Tool | Role |
|---|---|
| TypeScript 7 (`strict`) | types end to end |
| oxlint (type-aware) + oxfmt | lint & format, Oxc-fast |
| Vite 8 + @crxjs/vite-plugin | bundling, HMR, manifest rewrite |
| SolidJS | popup + options UI (~7 kB runtime) |
| AI SDK 7 (`ai`) | one `generateText` for every provider, lazy-loaded chunk |

## Structure

```
manifest.json
src/
├── content.ts/.css    # toolbar injection into X (vanilla, 3 kB)
├── background.ts      # message hub, lazy-loads llm
├── lib/config.ts      # config, actions, prompts, storage
├── lib/llm.ts         # AI SDK call
├── lib/icons.ts       # HugeIcons free renderer
├── popup.html/.tsx    # status + open settings
└── options.html/.tsx  # provider, model, buttons, prompts
```

## Privacy

Keys and prompts never leave `chrome.storage.local`. Requests go directly from the background worker to your chosen provider.

## License

MIT — see [LICENSE](LICENSE).
