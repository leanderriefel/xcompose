# 0.2.1 smoke-test record

Tested on September 5, 2026 with the unpacked local Chrome extension on the signed-in X.com website and real OpenCode Go responses. Only disposable drafts were used; no posts or replies were submitted. Test drafts were cleared afterward.

- Timeline: multiline replacement, exact Undo, typing after replacement, and typing after Undo.
- Modal: generation locks editing; typing while locked does not modify the draft; Cancel restores editing; subsequent generation still succeeds.
- Focus regression: click/focus the read-only input while the provider is working, then verify its response replaces the original text instead of appending. This exposed a React selection-tracking issue that was fixed by re-establishing focus before selection.
- Reply: one toolbar button, Cancel inside the dropdown only, disabled generation actions while busy, cancellation, and successful subsequent replacement with emoji in the draft.
- The local Draft.js playground additionally compares DOM text with Draft's internal EditorState for blank lines, trailing newline, emoji, repeated replacements, and focus received while locked.
- Automated tests cover the 60-second client timeout, worker and provider failures, late responses after cancellation, and aborting only the matching tab/frame's provider request.
- Outgoing OpenCode requests were checked with mocked transport for all three API adapters; session persistence and concurrent initialization are covered separately.

Firefox was built and checked with Mozilla's extension validator. An interactive Firefox browser test was not performed in this session. Store review and publication are separate from these tests.
