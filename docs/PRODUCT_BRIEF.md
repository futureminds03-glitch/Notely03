# Notely — Product Brief

**Version:** 0.1.0  
**Product tagline:** Just write — nothing else.  
**Production:** https://notely03.vercel.app  
**Lifecycle:** pre-1.0, actively developed

## 1. Product intent

Notely is a minimal personal writing and note-taking product. It prioritizes low-friction capture over the complexity of a full workspace, while retaining retrieval, history, and optional AI assistance.

### Product principles
1. **Writing comes first.** Keep the primary interaction focused on title and body.
2. **Protect the draft.** Autosave, write ordering, and guest-local persistence reduce accidental loss.
3. **History is useful.** Users can inspect prior body snapshots and restore one.
4. **Assistance is optional.** AI summarization supplements the user's text rather than replacing it.
5. **Work across screens.** Provide responsive layouts and installable-web-app affordances.

## 2. Users and jobs to be done

Primary user: an individual who wants a quick place to capture thoughts, meeting notes, reminders, drafts, and personal text without managing a complex workspace.

Key jobs:
- Capture a thought before it is forgotten.
- Return to an earlier note and find it by title or body.
- Recover an earlier body version.
- Get a concise summary of a longer note.
- Take notes without an account, or sign in to use cloud-backed notes.

## 3. Feature inventory

| Feature | Current behavior | Dependencies / boundaries |
| --- | --- | --- |
| Note editor | Title/body fields, word count, capture timestamp | Browser UI |
| Autosave | Debounced save with saving/saved/error state; serialized writes per note | Local storage for guests; authenticated API for signed-in users |
| Guest mode | Notes persist in browser local storage | Browser-specific; not cloud-synced |
| Accounts | Email/password sign-up and sign-in through Supabase Auth | Supabase configuration |
| Cloud notes | API routes read/write notes for the authenticated user | Supabase database, policies, auth cookies |
| Search | Filters notes by title and body | Currently loaded note collection |
| Time Travel | Select historical body snapshots by timestamp and restore one | Version rows/history must be available; focused on body content |
| AI summary | Appends a concise summary to the current note | GROQ_API_KEY and provider availability; body input limited to 4,000 characters |
| Export | Downloads title, capture time, and body as plain text | Browser download |
| Link preview | Extracts title, description, image, and paragraph text from a page URL | Guarded outbound fetch; remote HTML varies |
| PWA affordances | Manifest, icon, service-worker registration, mobile layouts | Browser/platform support varies |

## 4. Main user flows

### Guest note
1. Open the app and create a note.
2. Enter a title and body.
3. Changes are debounced and guest notes are stored in local storage.
4. Search, revisit, export, or inspect available history in the same browser.

### Signed-in note
1. Authenticate through Supabase.
2. The app loads the user's active notes.
3. Changes go through authenticated API routes.
4. Supabase Realtime updates may refresh notes after external changes.
5. Signing out returns the app to guest-mode notes stored in this browser.

### Time Travel
1. Write or edit a body so version history is recorded.
2. Use the range slider to select a snapshot.
3. Review the historical body.
4. Choose Restore to make the selected body current.

## 5. Product success measures

Recommended measures to instrument and review:
- Time from app open to first saved note.
- Successful save rate and save latency, split by guest/signed-in.
- Draft-loss and stale-write incidents.
- Weekly active writers and notes created per active writer.
- Search success and time to reopen a note.
- Time Travel usage and successful restores.
- AI summary success rate, latency, and provider errors.
- Mobile editor completion and retention.
- Error rate and production E2E pass rate.

These are recommendations, not claims that analytics are currently implemented.

## 6. Product quality requirements

- Typing in title/body must not erase or revert the active draft.
- A stale network response must not overwrite a newer draft.
- Save failures must be visible and not represented as successful saves.
- Switching notes should preserve each note's pending draft and avoid cross-note writes.
- Historical text must be distinguishable from the live draft; restore should persist the selected body.
- Search and editing should remain usable on desktop and mobile.
- Cloud data must be isolated by authenticated identity and database policy.
- Invalid or private-network URLs must not be fetched by link-preview functionality.
- Releases must pass build and E2E verification, with results recorded.

## 7. Known limitations and product status

- Version 0.1.0 is pre-1.0; interfaces and behavior may change.
- Guest notes are browser-local and are not automatically synchronized to a signed-in account.
- Time Travel currently focuses on body snapshots; do not describe it as full-document versioning for title and metadata.
- AI summarization depends on a Groq key and provider/network availability.
- Link previews depend on third-party pages and the HTML available to the fetcher.
- PWA assets and service-worker registration exist; full offline functionality and background sync should not be promised without dedicated verification.
- Performance, accessibility, and security are ongoing engineering responsibilities. A configured E2E workflow is not proof of a passing run.

## 8. Out of scope unless explicitly added

Do not market the current implementation as providing team workspaces, collaboration, sharing permissions, end-to-end encryption, file attachments, a knowledge graph, guaranteed offline cloud sync, or enterprise compliance certifications.
