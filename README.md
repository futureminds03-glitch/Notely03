# Notely

**Just write — nothing else.**

Notely is a lightweight personal note-taking web app focused on getting ideas down quickly. It combines a distraction-light writing surface with autosaving, searchable notes, version history, an adaptive ADHD-friendly Flow workspace, optional AI assistance, and a mobile-friendly installable experience.

- **Production app:** https://notely03.vercel.app
- **Repository:** https://github.com/futureminds03-glitch/Notely03
- **Current package version:** 0.1.0 (pre-1.0)
- **Status:** actively developed; see [CHANGELOG.md](CHANGELOG.md) and [product status](docs/PRODUCT_BRIEF.md#known-limitations-and-product-status).

## Product at a glance

### Core capabilities
- **Fast writing:** title and body fields with word count and save-state feedback.
- **Autosave:** debounced saves, per-note write ordering, and local guest persistence.
- **Notes library:** create, open, search, and delete notes.
- **Time Travel:** browse recorded note-body versions by timestamp and restore an earlier version.
- **AI summaries:** append a concise summary using the configured Groq API.
- **Notely Flow:** one-step brain dumps, browser voice transcription, an app-wide quick-capture overlay (`Ctrl/Cmd+Shift+Space`), a synced Parking Lot for signed-in users, AI De-Clutter, contextual resurfacing, focus timer, low-friction reading layouts, and source-linked webpage capture at `/flow/links`.
- **Export:** download a note as a plain-text TXT file.
- **Smart Recall:** ranked natural-language retrieval, related-memory recommendations, and source-linked Ask My Memory; cloud search is enforced by the authenticated Supabase session.
- **Notely MCP:** a remote Streamable HTTP MCP server with OAuth 2.1 authorization-code + PKCE, scope-filtered tools, note history, timeline, saved-link context, audited calls, rate limits, and idempotent mutations. See [MCP architecture and integration](docs/mcp.md).
- **Accounts and sync:** Supabase Auth and cloud-backed notes for signed-in users.
- **Mobile/PWA support:** responsive mobile views, web app manifest, service worker registration, and app icon.

Feature availability depends on environment configuration. AI summaries, AI De-Clutter, and AI-generated memory synthesis require the server-side `GROQ_API_KEY`; Smart Recall's ranked source retrieval works without it; cloud accounts and sync require Supabase configuration. Voice transcription depends on browser Speech Recognition support and microphone permission. Signed-in Parking Lot entries sync through the authenticated Supabase API; guest Parking Lot entries and focus-session counts remain browser-local.

## Technology

| Area | Implementation |
| --- | --- |
| Web framework | Next.js 16 App Router |
| UI | React 19, TypeScript, custom CSS |
| Authentication and data | Supabase Auth, Postgres, Realtime |
| AI summaries | Groq Chat Completions API, llama-3.1-8b-instant |
| Link capture | Server-side SSRF-guarded extraction, article metadata, source text, and optional Groq insights |
| Icons | Lucide React |
| Hosting | Vercel |
| Browser regression tests | Playwright and GitHub Actions |
| Package manager | pnpm, lockfile: pnpm-lock.yaml |

See [architecture](docs/ARCHITECTURE.md), [Notely MCP](docs/mcp.md), [product brief](docs/PRODUCT_BRIEF.md), and [memory engine](docs/MEMORY_ENGINE.md).

## Quick start

### Requirements
- Node.js 24.19 or later (Vercel runtime: Node 24.x)
- pnpm compatible with the repository lockfile
- A Supabase project for authentication and cloud-backed notes
- A Groq API key only if AI summaries and Flow's AI De-Clutter are to be enabled

### Install and run

    corepack enable
    pnpm install --frozen-lockfile
    pnpm dev

Open http://localhost:3000.

### Environment variables

Create a local .env.local file. Never commit real credentials.

| Variable | Required for | Exposure |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Supabase client and cloud features | Public configuration |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Supabase browser client (preferred) | Public/publishable key |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Legacy-compatible fallback | Public/anonymous key |
| GROQ_API_KEY | AI summaries and Flow AI De-Clutter | **Server-only secret** |
| OPENAI_API_KEY | Optional 1,536-dimensional memory embeddings; not required for lexical recall | **Server-only secret; provider usage may incur charges** |
| SUPABASE_SERVICE_ROLE_KEY | MCP OAuth control plane, token validation, and audited server-side MCP operations | **Server-only secret; never expose to browser code** |

Supabase's database schema and row-level security policies must be configured for the tables used by the application, including documents and version history. Review the API routes before configuring a new database. Do not expose service-role keys in NEXT_PUBLIC variables.

### Production build

    pnpm build
    pnpm start

## Testing

The repository contains a Playwright end-to-end suite in tests/e2e/, configuration in playwright.config.js, and GitHub Actions automation in .github/workflows/production-e2e.yml.

    npx playwright install chromium
    npx playwright test tests/e2e --reporter=list

Check the Actions run for the actual outcome; the existence of a workflow file does not prove a run passed.

## Repository map

    app/
      api/notes/          Authenticated note CRUD and version history
      api/organize/       Groq-backed brain-dump organization
      api/parking-lot/   Authenticated Parking Lot read/write/delete
      api/mcp/           Scope-aware remote MCP server
      api/oauth/         OAuth 2.1 registration, authorization, token, and revocation
      api/memory/        Owner-scoped ranked search, related memories, and source-grounded Q&A
      api/summarize/      Groq-backed summary endpoint
      api/link-preview/   Server-side page metadata extraction
      auth/               Authentication callback routes
      flow/               Adaptive Notely Flow workspace
      globals.css         Application styling
      layout.tsx          Metadata, viewport, PWA registration
      page.tsx            App entry point
    components/
      NotelyApp.tsx       Main note-taking experience and desktop/mobile Flow navigation
      NotelyFlow.tsx      Brain dump, Parking Lot, focus, and resurfacing
      GlobalParkingCapture.tsx  App-wide quick-capture overlay
    lib/
      supabase-client.ts
      supabase-server.ts
      mcp/                MCP tool registry and OAuth primitives
      safe-url-fetch.ts
    public/               Static assets, manifest, service worker, icons
    tests/e2e/            Playwright regression tests
    .github/workflows/    CI and production E2E workflow
    docs/                 Product and engineering documentation

## Releases and change management

- Product version: 0.1.0 in package.json.
- User-facing history: [CHANGELOG.md](CHANGELOG.md).
- Release process: [docs/RELEASE_PROCESS.md](docs/RELEASE_PROCESS.md).
- Production URL: https://notely03.vercel.app.
- A release is verified only after required checks pass, Vercel reaches READY for the intended commit, and production smoke checks pass.

## Security and privacy

- Keep secrets in local environment files or hosting-provider environment configuration.
- Never commit API keys, access tokens, service-role keys, or real user data.
- Cloud note access must be scoped to the authenticated user through server-side authorization and Supabase policies.
- The link-preview endpoint is an SSRF boundary; maintain guarded URL fetching.
- Report suspected vulnerabilities privately rather than publishing exploit details.

See [SECURITY.md](SECURITY.md).

## Project governance

- Contribution expectations: [CONTRIBUTING.md](CONTRIBUTING.md).
- Product scope and status: [docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md).
- Engineering architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

No license file is currently included. Unless a license is added by the project owner, do not assume the source code is open-source or granted for reuse.
