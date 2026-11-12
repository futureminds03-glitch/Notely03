# Notely state-machine registry

This registry is the behavioural contract for asynchronous and persistent workflows. It distinguishes UI presentation state from durable domain state. A machine may have several implementation sites today; those are candidates for consolidation, not separate sources of truth.

## Transition inventory

Notation: `A --event--> B`. Any edge not listed in the executable registry is illegal. The registry lives in `lib/state-machines.js`; regression tests live in `tests/state-machines.test.mjs`.

| Machine | State path / legal transitions | Current implementation ownership |
|---|---|---|
| Authentication | initializing → guest/authenticated/error; guest → authenticating; authenticating → authenticated/guest; authenticated → signingOut/guest; signingOut → guest/authenticated | Supabase auth in NotelyApp, NotelyFlow, MemoryStudio |
| Workspace hydration | loading → hydrating/cloudLoading; hydrating → cloudLoading/readyOffline/ready/error; cloudLoading → ready/readyOffline/cancelled; ready ↔ readyOffline; ready → syncing → ready/readyOffline | Page-level effects in all three screens |
| Note lifecycle | new → draft/active; active → dirty/saving/deleting/closed; dirty → saving/closing/deleting; saving → active/dirty/saveError/deleting; deleting → deleted/active | NotelyApp editor |
| Autosave queue | idle → queued → running; running → idle/failed/queued; failed → queued/idle | NotelyApp debounce, per-note promise queue, save sequence refs |
| Note sync | clean → pendingCreate/pendingUpdate/pendingDelete; pending* → creating/updating/deleting; in-flight → clean/blocked/pendingDelete; blocked → retry/discard | offline-notes.ts + NotelyApp + NotelyFlow + MemoryStudio |
| Parking sync | clean → pendingCreate/pendingDelete; pending → creating/deleting; in-flight → clean/blocked/pendingDelete; blocked → retry/discard | offline-workspace.ts + NotelyFlow + GlobalParkingCapture |
| Image sync | local → uploading → remote → complete; uploading → blocked/local; blocked → uploading/discarded | NotelyApp image resolver + offline-images.ts |
| Realtime reconciliation | disconnected → subscribing → connected; connected → reconciling → connected; disconnect from connected/reconciling | Supabase channel in NotelyApp |
| Version history | followingLatest → browsing → restoring → followingLatest; browsing → followingLatest | NotelyApp history timer, travel index, restore |
| Voice capture | idle → starting → listening → stopping → idle; error → starting/idle | NotelyFlow SpeechRecognition |
| Brain Dump / capture | empty → capturing → organizing → preview → saving → empty; errors return to editable state | NotelyFlow |
| Focus timer | idle → running ↔ paused; running → completed; reset from running/paused/completed | NotelyFlow interval + localStorage session count |
| Memory archive | loading → cached/cloud-backed → ready; ready → refreshing/failed | MemoryStudio and offline-notes |
| Smart Recall | idle → searching → ranked/empty/failed → opened; retry/search from result states | MemoryStudio API and local ranking |
| Memory indexing | idle → indexing → progress/complete/failed/cancelled; retry/reindex | memory-engine and note API routes |
| Thought connections | unselected → selected → matching → results/empty/failed | MemoryStudio related-source state |
| Tag update | clean → locally changed → pending → sending → synced/blocked | offline-workspace tagUpdates store + MemoryStudio |
| Mobile navigation | list → editor → list | NotelyApp mobileView |
| Time Machine | closed → open → date selection → results → note opened/closed | NotelyApp time machine state |
| Link capture | empty → fetching → extracted → analysing → preview → saving → complete; retry/reset on failure | Flow links route |
| Memory resurfacing | idle → ranked → filtered → opened | NotelyFlow and MemoryStudio |
| Search/filter | idle → query changed → filtered → cleared | NotelyApp and MemoryStudio |
| Export/share | idle → preparing → rendered/downloaded/shared or failed | editor export/share actions |
| Deployment refresh | current → update available → reload requested → reloaded | DeploymentRefresh component |

## Illegal transitions and invariants

1. A cloud response for a previous auth generation must never overwrite the current user's workspace.
2. A deleted record must remain a tombstone until its remote delete is acknowledged; an in-flight create/update cannot resurrect it.
3. A stale save completion must not clear dirty flags or mark a newer draft saved.
4. A stale AI result must not mutate a note after its note ID or source content changes.
5. A realtime event must not overwrite locally pending or dirty fields.
6. A note create conflict (same client ID already exists) must resolve to an update/reconciliation path, not an endless create retry.
7. A failed sync item must remain pending/blocked and observable; it must not be silently discarded or marked synced.
8. Local image markers may be replaced with remote paths only if the source note/version has not changed during upload.
9. A version restore is not complete until the restored content has been persisted.
10. A parking item promoted to a note must not lose either copy until note creation is durable and inbox deletion is acknowledged.
11. Only one sync worker may mutate a given owner-scoped queue at a time; different owners must never share queue state.
12. Focus timer completion must be idempotent: interval rerenders cannot count one session more than once.
13. Voice callbacks after stop/unmount must not append late transcripts to a new capture.
14. Memory indexing/recall results must be scoped to the authenticated owner and current request generation.

## Consolidation plan

### Phase 1 — Contract and regression baseline
- Define explicit transition tables and forbidden edges.
- Test every transition target and key create/update/delete, conflict, retry, cancellation and stale-response paths.
- Keep this registry framework-independent so tests run with Node's built-in test runner.

### Phase 2 — Shared sync coordinator
- Make a single owner-scoped coordinator the only scheduler for note, parking, tag and image queues.
- Preserve domain adapters for each record type; centralize single-flight execution, ordering, retries, online wakeups, and status reporting.
- Remove page-owned sync loops only after their behaviour is covered by coordinator integration tests.

### Phase 3 — Migrate consumers
- NotelyApp, NotelyFlow, MemoryStudio and GlobalParkingCapture become producers/observers of queue work, not independent sync workers.
- Keep IndexedDB as the durable outbox and preserve tombstones and version metadata.
- Keep UI state local; publish one shared sync snapshot for badges/status.

### Phase 4 — Runtime verification
- Exercise guest/authenticated, online/offline, reload, account-switch, create/update/delete races, duplicate create, image upload failure, tag update, and parking promotion.
- Run unit tests, typecheck, production build and browser E2E before merge or deployment.

## Current scope and caveat

The registry and tests establish explicit legal-transition contracts. The existing components are not yet fully migrated to consume the registry; that migration is intentionally sequenced after the contract baseline. Do not describe the consolidation as complete until the independent workers have been removed and cross-screen integration tests pass.
