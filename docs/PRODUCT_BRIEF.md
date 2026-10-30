# Notely — Product Brief

**Version:** 0.1.0  
**Product tagline:** Just write — nothing else.  
**Production:** https://notely03.vercel.app  
**Lifecycle:** pre-1.0, actively developed

## 1. Product intent

Notely is a minimal personal writing and note-taking product with an adaptive Flow workspace. It prioritizes low-friction capture over the complexity of a full workspace, while retaining retrieval, history, and optional AI assistance. Flow extends the product with ADHD-friendly patterns without requiring an ADHD diagnosis or making clinical claims.

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
| Search | Local guest filtering plus authenticated server-ranked recall over title/body/tags | Indexed Postgres full-text search; source notes stay owner-scoped |
| Smart Recall | Natural-language query retrieval, related-memory suggestions, and Ask My Memory with clickable source notes | Supabase `search_vector` + GIN index and owner-scoped `SECURITY INVOKER` RPC; ranked retrieval works without AI; AI synthesis requires GROQ_API_KEY |
| Memory Q&A | Retrieves up to six relevant source notes and optionally synthesizes a concise answer with inline source references | Server-side retrieval only; browser-supplied note arrays are ignored; AI provider receives only selected excerpts when configured |
| Time Travel | Select historical body snapshots by timestamp and restore one | Version rows/history must be available; focused on body content |
| AI summary | Appends a concise summary to the current note | GROQ_API_KEY and provider availability; body input limited to 4,000 characters |
| Notely Flow | Adaptive workspace for capture, Parking Lot, focus, and resurfaced notes; global quick-capture overlay is available across app routes | Browser UI; desktop/mobile navigation plus floating overlay and Ctrl/Cmd+Shift+Space shortcut; not an OS-wide overlay |
| Brain Dump | Saves unstructured text without requiring a title or folder; browser speech-to-text is available where supported | Existing notes API for signed-in users; localStorage for guests; microphone permission and Speech Recognition browser support |
| Parking Lot | Temporary quick-capture queue; entries can be promoted into notes | Signed-in users sync through an authenticated owner-scoped API using `documents.status = 'parking'`; guest entries remain browser-local |
| AI De-Clutter | Creates a structured version of a brain dump while preserving the original | GROQ_API_KEY and provider availability; request capped at 12,000 characters |
| Memory resurfacing | Ranks existing notes by lexical overlap with a current topic or parked thoughts | Local heuristic over the currently loaded note collection; suggestions, not semantic/AI guarantees |
| Related memories | Choose a source note and retrieve other owner-scoped notes with overlapping indexed terms | Authenticated API; suggestions are clues, not guaranteed relationships |
| Focus tools | 15/25/45-minute focus timer and locally stored completed-session count | Browser-local state; no background alarm guarantee |
| Reading layouts | Bionic reading toggle and cards/outline layout for resurfaced notes | Browser UI |
| Export | Downloads title, capture time, and body as plain text | Browser download |
| Link preview | Extracts title, description, image, and paragraph text from a page URL | Guarded outbound fetch; remote HTML varies |
| PWA affordances | Manifest, icon, service-worker registration, mobile layouts | Browser/platform support varies |

### Smart Recall boundaries
- Cloud retrieval uses the existing `documents.search_vector` generated column and GIN index; it is ranked full-text retrieval, not vector-embedding semantic search.
- True embedding-based semantic retrieval and automated entity extraction are not enabled in this release; they require a configured embedding model/provider and a separately evaluated indexing pipeline.
- If `GROQ_API_KEY` is absent, Ask My Memory still returns ranked source notes and excerpts without generating unsupported AI claims.

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

### Notely Flow
1. Capture an interruption from any Notely screen with the floating Quick Capture button or Ctrl/Cmd+Shift+Space, or open Flow from desktop/mobile navigation.
2. Park the thought without leaving the current page, or capture a brain dump in Flow by typing or browser-supported speech transcription; add an optional cue for future-you.
3. Save it directly into the existing notes collection without choosing a folder or title.
4. Park distracting thoughts in the Parking Lot; signed-in users can resume them across devices, while guest entries stay in the current browser. Promote parked thoughts into notes when ready.
5. Optionally use AI De-Clutter to create a structured copy; the original remains intact.
6. Use Focus for a gentle timer, or Resurfaced to find notes with overlapping terms and open them in the main editor.

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
- AI summarization and Flow AI De-Clutter depend on a Groq key and provider/network availability. The production Vercel project currently has no `GROQ_API_KEY`, so De-Clutter safely returns a configuration error until the owner supplies the secret.
- Flow voice transcription depends on browser Speech Recognition support and microphone permission; it stores the transcript, not a raw audio recording.
- Guest Parking Lot entries and focus-session counts are browser-local. Signed-in Parking Lot entries sync across devices through the authenticated API.
- Global Quick Capture is available across Notely web-app routes, including Memory Studio and Flow, but it is not a system-wide OS overlay or desktop widget.
- Voice capture stores the transcript, not a raw audio recording; no automatic audio snippet is retained.
- Global Quick Capture uses the authenticated Parking Lot API for signed-in users and the same browser-local Parking Lot store for guests; failed network requests stay visible in the dialog rather than silently falling back to local storage.
- Reading layout choices currently include cards and outline. Kanban/mind-map rotations, dynamic themes, and soundscape rewards are not implemented.
- Memory resurfacing currently uses transparent lexical-overlap ranking, not embeddings or a semantic AI agent.
- Link previews depend on third-party pages and the HTML available to the fetcher.
- PWA assets and service-worker registration exist; full offline functionality and background sync should not be promised without dedicated verification.
- Performance, accessibility, and security are ongoing engineering responsibilities. A configured E2E workflow is not proof of a passing run.

## 8. Out of scope unless explicitly added

Do not market the current implementation as providing team workspaces, collaboration, sharing permissions, end-to-end encryption, file attachments, a knowledge graph, guaranteed offline cloud sync, or enterprise compliance certifications.
