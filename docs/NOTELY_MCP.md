# Notely MCP

Notely MCP exposes the signed-in user's Notely data to compatible MCP clients through the Next.js Streamable HTTP endpoint:

- Endpoint: `https://notely03.vercel.app/api/mcp`
- Transport: Streamable HTTP, stateless JSON-RPC POST
- Protocol version: `2025-06-18`
- Authentication: Supabase user access token in `Authorization: Bearer <access-token>`
- Storage: existing Supabase `documents` and `document_versions` tables; no second data store

## Available tools

| Tool | Capability | Risk |
| --- | --- | --- |
| `list_notes` | Paginated active notes, optional tag filter | Read |
| `get_note` | Full note by ID | Read |
| `list_tags` | Tag inventory and note counts | Read |
| `list_note_versions` | Read note body history | Read |
| `restore_note_version` | Restore an earlier body as a new version | Write |
| `create_note` | Create note and initial version | Write |
| `update_note` | Partial update; body edits add a version | Write |
| `archive_note` | Archive an active note | Destructive |
| `search_notes` | Ranked Smart Recall search | Read |
| `list_parking_lot` | List synced parked thoughts | Read |
| `park_thought` | Save a thought to Parking Lot | Write |
| `remove_parked_thought` | Permanently remove a parked thought | Destructive |
| `search_memories` | Smart Recall source retrieval without an AI provider call | Read |

## Security model

- Every request must carry a valid Supabase access token issued by the Notely Supabase project.
- The token is verified with Supabase Auth before any tool is dispatched.
- Queries include the authenticated user's ID and use the publishable/anon key plus the user's JWT; the server does not use a service-role key or bypass RLS.
- Guest/local-only notes are intentionally not exposed. Only signed-in cloud data is available.
- Note bodies are returned only by explicit `get_note` and write operations; list and search return excerpts/source records.
- The endpoint does not log note bodies or access tokens.
- Tool schemas identify read-only and destructive actions for clients that honor MCP annotations.

## Current integration boundary

This first server slice implements authenticated tools and Streamable HTTP transport. It does **not** yet implement an OAuth 2.1 authorization server, dynamic client registration, or token issuance for third-party MCP clients. A client must already possess a Notely Supabase access token. Do not publish a connection manifest or claim one-click ChatGPT/Claude setup until the OAuth authorization flow is implemented and verified.

## Protocol notes

- JSON-RPC methods implemented: `initialize`, `ping`, `tools/list`, and `tools/call`.
- Initialization advertises the tools capability.
- Notifications `notifications/initialized` and `notifications/cancelled` receive HTTP 202.
- GET is not used for server-initiated SSE; the endpoint is stateless request/response.
- CORS preflight is supported. Authentication is still required for all tool operations.
