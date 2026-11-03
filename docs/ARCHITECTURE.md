# Notely — Engineering Architecture

## System overview

    Browser / PWA
      ├─ Next.js client UI (React)
      └─ MCP clients → /api/mcp → Supabase Auth + owner-scoped Postgres/RLS
          ├─ Guest notes ───────────── browser localStorage
          ├─ Auth ──────────────────── Supabase Auth
          ├─ Note CRUD ─────────────── Next.js route handlers
          │                              └─ Supabase Postgres + RLS
          ├─ Live updates ──────────── Supabase Realtime
          ├─ AI summaries ──────────── /api/summarize → Groq API
          ├─ Flow workspace ────────── /flow → NotelyFlow client
          │                              ├─ Parking Lot / focus state → browser localStorage
          │                              ├─ Brain Dump → existing /api/notes or guest store
          │                              └─ AI De-Clutter → /api/organize → Groq API
          ├─ Memory resurfacing ─────── local lexical-overlap ranking over loaded notes
          └─ Link metadata ─────────── /api/link-preview
                                         └─ guarded URL fetch helper
    Hosting: Vercel
    Source of truth: GitHub main branch
    Regression: Playwright + GitHub Actions

## Application layers

### Client
- app/page.tsx dynamically loads components/NotelyApp.tsx as a client-side application.
- components/NotelyApp.tsx owns the editor, guest mode, sign-in UI, search, save queue, version selection, AI summary action, export, and note deep-link opening from Flow.
- components/NotelyFlow.tsx owns brain-dump capture, browser speech transcription, Parking Lot, focus timer, contextual resurfacing, and reading layouts.
- app/globals.css contains responsive styles and editor/scrubber styles.
- lib/supabase-client.ts creates the browser client using public URL/key configuration.

### Server routes
- app/api/notes/route.ts: authenticated note collection operations and version-history reads/writes.
- app/api/notes/[id]/route.ts: authenticated per-note update/delete operations.
- app/api/summarize/route.ts: validates note body, limits submitted content, calls Groq, and returns a summary.
- app/api/organize/route.ts: validates brain-dump text (12,000-character maximum), requires server-only GROQ_API_KEY, calls Groq with a 20-second timeout, and returns a structured Markdown copy. It does not mutate the source note.
- app/api/link-capture/route.ts: safely fetches public webpages, extracts article metadata and readable source text, then optionally generates source-grounded summaries, key points, concepts, and potential tasks with Groq. When Groq is not configured or unavailable, a deterministic source-based overview remains available.
- lib/link-extractor.ts: pure, tested HTML/JSON-LD metadata and article-text extraction plus deterministic extractive analysis.\n- app/flow/links/page.tsx and components/LinkCapture.tsx: dedicated URL capture UI; saves original and resolved URLs, metadata, extracted text, and insights as a Links-tagged note using the existing cloud/guest note persistence.
- lib/supabase-server.ts: server-side Supabase client and request-cookie integration.
- app/auth/: authentication callback route(s).

Review source for the exact route contract before changing behavior; this document is a map, not a replacement for implementation.

## Data and state model

### Client note shape
- id: note identifier
- user_id: optional cloud owner
- title and body: current content
- created_at and updated_at: timestamps
- started_at: optional capture timestamp
- history: client-facing body snapshots and timestamps
- synced: client-side sync indicator

### Flow workspace state
- Brain dumps are persisted through the existing notes API for signed-in users or the existing `notely_notes` guest localStorage collection.
- Parking Lot entries use `notely_parking_lot_v1` in browser localStorage and are promoted into the regular notes collection on request.
- Focus-session counts use `notely_focus_sessions_v1`; timer state is transient.
- Memory resurfacing uses a lexical-overlap heuristic on notes already loaded by the client. It is not a semantic vector search.
- Browser speech capture uses the Web Speech Recognition API where available; the implementation stores recognized text and does not persist raw audio.

### Persistence modes
- **Guest:** notes serialized to browser localStorage under the key notely_notes. This is scoped to the browser profile and origin.
- **Signed in:** note API routes use the authenticated Supabase user and database. Row-level security is a critical defense-in-depth requirement.
- **Version history:** API routes use a document-version table alongside documents. Inspect current route queries and database configuration before migrations; do not infer a complete schema from client types alone.

### Save consistency
The client debounces edits, tracks dirty fields, queues writes per note, and uses sequence numbers to prevent older requests from applying after newer drafts. When changing this flow, test rapid typing, note switching, network failures, sign-in/out transitions, and pending-save behavior.

## External services

| Service | Purpose | Required configuration |
| --- | --- | --- |
| Supabase | Authentication, Postgres data, Realtime | NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY |
| Groq | Text summarization | GROQ_API_KEY, server-only |
| Vercel | Production hosting/deployments | Project configuration and environment variables |
| GitHub Actions | Build and browser regression automation | Workflow permissions and browser dependencies |

## Security boundaries

- Client-published Supabase keys are intended to be public/publishable; they do not replace server authorization or database RLS.
- Never place a Supabase service-role key or Groq secret in a public variable or source file.
- Note APIs must verify the current user and constrain database operations to that user's records.
- Link capture fetching is an SSRF boundary: maintain private-address blocking, redirect validation, DNS/address checks, timeouts, and response-size limits in lib/safe-url-fetch.ts. Treat fetched page text as untrusted input to AI.
- Treat note content as private user data; avoid logging raw bodies or credentials.
- Review dependencies and lockfile changes when changing packages.

## Runtime and package details

- Framework: Next.js 16 App Router
- UI runtime: React 19 / React DOM 19
- Language: TypeScript 5
- Supabase clients: @supabase/ssr and @supabase/supabase-js
- Icons: lucide-react
- Lockfile: pnpm-lock.yaml
- package.json scripts: dev, build, start
- E2E configuration: playwright.config.js; tests: tests/e2e/

## Change impact guide

| Change area | Minimum verification |
| --- | --- |
| Editor, save queue, switching notes | E2E typing/save/switch tests; build |
| Time Travel/history | selection, restore, save regression; desktop and mobile interaction |
| Auth/session | sign-in/out, unauthenticated API response, per-user isolation |
| Database/API routes | authorization, validation, RLS review, regression suite |
| Link capture/URL fetch | metadata parsing, source traceability, guest/cloud persistence, private IPv4/IPv6, redirect, DNS rebinding, timeout and size-limit tests |
| AI summaries | missing key, empty body, provider error, long input, successful summary |
| PWA/responsive layout | mobile viewport, install/offline behavior tested separately |
| Dependency updates | frozen lockfile install, build, E2E, dependency/security review |
