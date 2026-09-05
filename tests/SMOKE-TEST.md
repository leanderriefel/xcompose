# Smoke-test record

## 0.2.2 Firefox regression — September 5, 2026

- Reproduced the shipped 0.2.1 editor helper in a temporary Firefox extension against real page-world Draft.js: replacements returned false and left the original text selected and unchanged.
- Fixed the empty page-visible clipboard payload, then caught and fixed a second Firefox failure during subsequent editing caused by moving Draft.js's caret to the outer editor boundary.
- Firefox 155 and Chromium 153 both passed seven real content-script checks: replacement, multiline/blank lines, emoji/trailing newline, restoration of the original draft, replacement after focus while locked, subsequent native editing, and isolation from a second composer. DOM text was checked against the page's rendered EditorState.
- All 28 unit tests passed. The real-browser suite is required by the packaging command and runs in both GitHub check and release workflows.
- These are local browser integration tests. An interactive test of 0.2.2 on the user's signed-in X.com Firefox session is still pending; do not describe the local fixture as an actual X.com test.

## 0.2.1

Tested on September 5, 2026 with the unpacked local Chrome extension on the signed-in X.com website and real OpenCode Go responses. Only disposable drafts were used; no posts or replies were submitted. Test drafts were cleared afterward.

- Timeline: multiline replacement, exact Undo, typing after replacement, and typing after Undo.
- Modal: generation locks editing; typing while locked does not modify the draft; Cancel restores editing; subsequent generation still succeeds.
- Focus regression: click/focus the read-only input while the provider is working, then verify its response replaces the original text instead of appending. This exposed a React selection-tracking issue that was fixed by re-establishing focus before selection.
- Reply: one toolbar button, Cancel inside the dropdown only, disabled generation actions while busy, cancellation, and successful subsequent replacement with emoji in the draft.
- The local Draft.js playground additionally compares DOM text with Draft's internal EditorState for blank lines, trailing newline, emoji, repeated replacements, and focus received while locked.
- Automated tests cover the 60-second client timeout, worker and provider failures, late responses after cancellation, and aborting only the matching tab/frame's provider request.
- Outgoing OpenCode requests were checked with mocked transport for all three API adapters; session persistence and concurrent initialization are covered separately.

Firefox was built and checked with Mozilla's extension validator. An interactive Firefox browser test was not performed in this session. Store review and publication are separate from these tests.
