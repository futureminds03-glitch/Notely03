# Changelog

All notable user-facing changes to Notely are recorded here. The project is pre-1.0; entries describe implementation scope, not a guarantee that every environment has every optional integration configured.

## Unreleased

- Product and engineering documentation established for the repository.
- Release verification expectations documented, including deployment readiness and browser regression checks.

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
