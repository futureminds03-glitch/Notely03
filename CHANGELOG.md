# Changelog

All notable user-facing changes to Notely are recorded here. The project is pre-1.0; entries describe implementation scope, not a guarantee that every environment has every optional integration configured.

## Unreleased

- Added source-linked Link Capture at `/flow/links`: safely fetches public webpages, extracts article text and publication metadata, and optionally generates grounded summaries, key points, concepts, and suggested next steps. A deterministic extractive overview remains available without Groq credentials. Saves the original and resolved URLs with the extracted source as a Links-tagged note, preserving guest and signed-in persistence paths.
- Added end-to-end coverage for extraction display, source traceability, guest save, cloud-save failure recovery, private-network URL rejection, and mobile layout.

- Added Smart Recall: owner-scoped ranked natural-language search over the existing indexed Postgres search vector, source-linked Ask My Memory, and related-memory recommendations.
- Removed browser-supplied note content from the Ask My Memory trust boundary; the server retrieves only the signed-in user's active notes through a SECURITY INVOKER RPC and existing row-level security.
- Added search, related-memory, and grounded-answer APIs with input limits, per-user question throttling, source excerpts, and a no-AI ranked retrieval mode when Groq is not configured.
- Added Playwright coverage for unsigned access denial, forged-note payload rejection, source citations/deep links, ranked search, and related-memory recommendations.

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
