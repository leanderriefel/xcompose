# Changelog

## 0.2.1 — 2026-09-05

- Replace drafts through the editor's paste handler to prevent duplicated text and frozen composers.
- Preserve blank lines and keep Undo available after a partially applied replacement.
- Lock the composer during generation, with a Cancel action in the dropdown and a 60-second timeout that restores editing. Disable other generation actions while running and ignore late responses after cancellation.
- Avoid overwriting typing or stealing focus during draft replacement.
- Keep one XCompose button per toolbar, including after composer changes.
- Send a stable OpenCode Go session header, including during concurrent requests.
- Time out stalled provider requests so the toolbar can recover.
- Add regression tests and a single release command that verifies and packages both browsers and Mozilla review sources on Windows, macOS, and Linux.
