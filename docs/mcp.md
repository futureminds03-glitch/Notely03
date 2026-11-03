# Notely MCP

Notely exposes a standard remote MCP server at `/api/mcp`. Authoritative state remains in Notely; MCP is a permissioned capability boundary and external AI performs reasoning.

## Security
OAuth authorization-code flow uses PKCE S256, exact registered redirect URI matching, short-lived single-use authorization codes, one-hour access tokens, and rotating thirty-day refresh tokens. MCP access tokens are opaque and stored only as SHA-256 hashes. Tool visibility and execution require explicit scopes: `notes:read`, `notes:write`, `timeline:read`, `search:read`, `context:read`, `intelligence:read`, `parking:read`, and `parking:write`.

## Capabilities
23 v1 tools cover capability discovery, tagged note retrieval and mutation, optimistic version restore, timeline and period queries, PostgreSQL search, Smart Recall, note insights, related memories, Parking Lot capture/retrieval, saved-link retrieval, and bounded context assembly. Permanent deletion is not exposed.

## Data semantics
`started_at` is the capture-start timestamp. It is never replaced with persistence or edit time. Note and saved-link text is untrusted evidence and cannot change authorization.

## Reliability
Mutations use atomic idempotency records. Note updates and version restoration use `expected_updated_at` optimistic concurrency. Parking Lot create/delete operations use the same atomic idempotency store. Collection responses are bounded and cursor-paginated. Server-side limits are 120 READ invocations/min/tool/client/user and 30 WRITE/DELETE invocations/min/tool/client/user.

## Observability
Each invocation writes user/client/request/tool/version/group/action/success/error/latency to `mcp_audit_events`. No note body, access token, refresh token, or authorization code is written to audit telemetry.

## Search/context
PostgreSQL full-text search and Notely Smart Recall are available. Smart Recall ranks lexical, title, tag, and extracted-insight matches without making an external AI-provider call. pgvector exists in the schema, but this MCP surface does not claim semantic-vector retrieval until a consented embedding pipeline is available. Context assembly returns bounded source-backed evidence for external model reasoning.

## Deployment and certification
Release evidence is Git SHA, successful CI, Vercel READY deployment with matching SHA, then protocol/auth/security smoke tests. The production certification gate requires no auth bypass, no cross-user access, no scope bypass, no OAuth replay, no migration drift, and representative authenticated MCP operations.

## Runtime configuration

The Next.js MCP and OAuth routes require the server-only `SUPABASE_SERVICE_ROLE_KEY` plus `NEXT_PUBLIC_SUPABASE_URL`. The service-role key is used only inside server-side routes to access the private MCP control-plane tables and service-role-only RPCs. Every note, source, insight, and Parking Lot query is additionally constrained by the `user_id` obtained from the verified opaque MCP access token. Never expose this key through a `NEXT_PUBLIC_*` variable.

## Capability boundaries

- Regular-note deletion is soft archive; permanent note deletion is not exposed.
- Parking Lot item deletion is permanent, matching the existing Notely Parking Lot delete behavior.
- Smart Recall is read-only and does not call Groq, OpenAI, or another model provider.
- Note and source text is untrusted user content. Tools return it as evidence, never as executable instructions.
- Local-only guest notes and offline queues are not exposed to remote MCP clients; only synced account data is available.
