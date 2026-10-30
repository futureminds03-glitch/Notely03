# Notely Memory Engine

## Scope

The memory engine turns saved documents into structured, retrievable memory records. It is designed to work without an AI provider for core indexing and full-text recall.

Pipeline:

1. Note create/update persists the document as usual.
2. Server-side indexing hashes the source and extracts a short deterministic summary, key topics, proper-name candidates and action-item candidates.
3. The insights are upserted through an owner-checked, `SECURITY INVOKER` Postgres RPC.
4. Optional 1,536-dimensional embeddings are generated only when `OPENAI_API_KEY` is explicitly configured.
5. Smart Recall, archive search and related-memory retrieval use a single owner-scoped hybrid RPC combining full-text rank, title/tag/insight matches and optional cosine similarity.
6. Every returned result includes its original document ID and match-reason metadata.

## Runtime behavior

- Core capture and deterministic extraction do not call an external AI service.
- Embedding generation is disabled unless the server-only `OPENAI_API_KEY` exists.
- The optional provider uses OpenAI's `text-embedding-3-small` endpoint and 1,536 dimensions to match the existing `document_embeddings.embedding vector(1536)` column.
- A provider timeout/error does not block note saving; lexical retrieval remains available.
- Updating a note invalidates its old embedding rather than returning stale semantic matches.
- The archive preparation endpoint processes 10 owner-scoped documents per batch. Memory Studio advances through batches until complete.
- No note body is written to application logs.
- AI answer synthesis remains separately dependent on `GROQ_API_KEY`; the memory index and ranked retrieval do not require it.

## Database migration

Migration: `supabase/migrations/20261031120000_memory_engine_hybrid_search.sql`

It adds:
- Source hash and extraction timestamp to `document_insights`.
- Unique document insight and document/model embedding indexes.
- HNSW cosine index for vector retrieval.
- `upsert_document_memory` RPC with authenticated owner checks and invoker privileges.
- `search_my_memories_hybrid` RPC with explicit `auth.uid()` ownership filtering.

The migration is additive. It does not delete or rewrite existing documents. Existing notes are backfilled only when the signed-in user chooses **Prepare my memory archive** in Memory Studio.

**Release ordering:** apply and verify this database migration first, then deploy the matching application commit. Do not deploy the application against a database that has not received this migration.

## Environment

| Variable | Purpose | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase endpoint | Cloud app |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public client key | Cloud app |
| `OPENAI_API_KEY` | Optional semantic embedding generation | No; provider usage may incur charges |
| `GROQ_API_KEY` | Optional source-grounded answer synthesis | No |

Never expose provider keys through `NEXT_PUBLIC_*` variables. No embedding key is configured by this code change. Do not add one without an explicit cost decision.

## Verification

Feature-branch pushes run the local build and E2E suite; only pushes to `main` run production smoke tests. The `feat/memory-engine` branch is excluded from Vercel deployments until release.

The E2E suite covers:
- Signed-out archive indexing is rejected.
- Memory Studio invokes the authenticated archive preparation flow.
- No semantic key is required for deterministic insight indexing.

Additional release checks:
- Verify the migration on a non-production database before production.
- Confirm each user can index/search only their own notes.
- Seed representative query/answer fixtures and compare hybrid retrieval against the existing lexical baseline.
- Verify embedding provider errors fall back to lexical retrieval.
- Verify note edits invalidate stale vectors.
- Confirm production migration version, index presence, RPC grants and Supabase security advisors before release.

## Known limits

- Deterministic topic/entity/action extraction is heuristic, not a language model. Proper-name extraction can produce false positives and does not claim complete entity recognition.
- Without `OPENAI_API_KEY`, retrieval remains full-text/tag/insight ranking; it is not semantic vector search.
- Without `GROQ_API_KEY`, Ask My Memory returns ranked source notes rather than generated synthesis.
- Vector generation is optional and has external provider usage costs when enabled.
- The new migration has been committed to the feature branch but is intentionally not applied to the live Supabase database as part of the no-deploy work session.
