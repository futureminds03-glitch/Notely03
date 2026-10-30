# Changelog

All notable user-facing changes to Notely are recorded here. The project is pre-1.0; entries describe implementation scope, not a guarantee that every environment has every optional integration configured.

## Unreleased

- Added Notely Flow, a persistent adaptive workspace for low-friction brain-dump capture, browser speech transcription, and an optional future-self cue.
- Added a Parking Lot with promotion into the existing notes collection; signed-in users sync parked thoughts through an authenticated, owner-scoped Supabase API, while guest entries remain browser-local.
- Added Groq-backed AI De-Clutter with bounded input, timeout handling, and non-destructive original preservation.
- Added contextual resurfacing of related notes, direct note-editor deep links, bionic reading, compact outline layout, and a gentle focus timer with local session counts.
- Added permanent Notely Flow shortcuts in desktop and mobile navigation, plus an app-wide quick-capture overlay with a Ctrl/Cmd+Shift+Space shortcut and immediate Parking Lot updates.
- Expanded Playwright regression coverage for global capture, keyboard activation, mobile navigation, Parking Lot authorization/persistence, organization validation, focus navigation, and memory layouts.
- Product and engineering documentation established for the repository; release verification expectations include deployment readiness and browser regression checks.

## 0.1.0 — Initial product baseline

- Minimal note editor with title/body fields and word count.
- Guest-mode persistence in browser local storage.
- Supabase authentication and cloud-backed note API for signed-in users.
- Search across note titles and bodies.
- Debounced saving, serialized per-note writes, and visible save status.
- Time Travel interface for reviewing and restoring body snapshots.
- Optional Groq-backed AI note summaries.
- Plain-text note export.
- Server-side link metadata extraction using a guarded outbound URL fetch helper.
- Responsive mobile interface and PWA-related manifest/service-worker registration.

### Release notes
- This entry records the package baseline declared as 0.1.0, not a separately verified GitHub Release object.
- Guest notes are browser-local; cloud sync requires Supabase configuration.
- AI summaries require GROQ_API_KEY.
- No open-source license is currently declared in the repository.
